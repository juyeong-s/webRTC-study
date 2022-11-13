import { useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";

// candidate: STUN, TURN 등으로 찾아낸 연결 가능한 네트워크 주소들
// ICE라는 프레임워크에서 Finding Candidate(후보 찾기)를 하게 됨.

function Video() {
  const { roomName } = useParams();

  const socketRef = useRef(null);
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream; // 내 비디오 스트림 설정
      }
      if (!(peerConnectionRef.current && socketRef.current)) return;

      stream.getTracks().forEach((track) => {
        if (!peerConnectionRef.current) return;

        peerConnectionRef.current.addTrack(track, stream);
        // 다른 유저에게 전송될 트랙 묶음에 새 미디어 트랙 추가
        // https://developer.mozilla.org/ko/docs/Web/API/RTCPeerConnection/addTrack
      });

      // onicecandidate: RTCPeerConnection.setLocalDescription() 호출에 의해 로컬 피어에 추가되면 icecandidate 이벤트가 RTCPeerConnection으로 전송됨.
      peerConnectionRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current?.emit("candidate", e.candidate, roomName);
        }
      };

      /* track(RTCPeerConnection에 트랙이 등록됨을 알려주는 이벤트)이 발생하면 호출되는 이벤트 핸들러 설정 */
      // https://developer.mozilla.org/ko/docs/Web/API/RTCPeerConnection/track_event
      peerConnectionRef.current.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0]; // remote 비디오 스트림 설정
        }
      };
    } catch (e) {
      console.error(e);
    }
  };

  /* SDP 생성 */
  const createOffer = async () => {
    if (!(peerConnectionRef.current && socketRef.current)) return;

    const sdp = await peerConnectionRef.current.createOffer();
    peerConnectionRef.current.setLocalDescription(sdp); // Caller의 로컬 SDP 설정
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setLocalDescription

    socketRef.current.emit("offer", sdp, roomName); // 소켓 서버에 sdp 전송
  };

  const createAnswer = async (sdp) => {
    if (!(peerConnectionRef.current && socketRef.current)) return;

    peerConnectionRef.current.setRemoteDescription(sdp); // Callee는 전달받은 SDP를 RemoteDescription으로 설정

    const answerSdp = await peerConnectionRef.current.createAnswer(); // Callee가 Caller에게 보낼 SDP 생성
    peerConnectionRef.current.setLocalDescription(answerSdp); // Caller와 마찬가지로 로컬 SDP 설정
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setRemoteDescription

    socketRef.current.emit("answer", answerSdp, roomName); // 생성한 SDP 를 소켓 서버에 전송
  };

  useEffect(() => {
    socketRef.current = io("localhost:8080");

    /* RTCPeerConnection 객체 생성 */
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    /* 입장했는데 다른 유저가 있을 경우 받는 이벤트 */
    socketRef.current.on("all_users", (allUsers) => {
      if (allUsers.length > 0) {
        createOffer();
      }
    });

    /* Offer 전달 받기 */
    socketRef.current.on("getOffer", (sdp) => {
      createAnswer(sdp);
    });

    /* 전달받은 SDP를 RemoteDescription으로 설정 */
    socketRef.current.on("getAnswer", (sdp) => {
      peerConnectionRef.current?.setRemoteDescription(sdp);
    });

    socketRef.current.on("getCandidate", async (candidate) => {
      await peerConnectionRef.current?.addIceCandidate(candidate);
      // 새로 수신된 candidate를 브라우저의 ICE 에이전트에 전달
      // 새로운 candidate를 RTCPeerConnection의 remote description에 추가함
      // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addIceCandidate
    });

    /* 소켓 room 접속 */
    socketRef.current.emit("join_room", {
      room: roomName,
    });

    getMedia();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return (
    <div>
      <video
        style={{
          width: 240,
          height: 240,
          backgroundColor: "black",
        }}
        ref={myVideoRef}
        autoPlay
      />
      <video
        style={{
          width: 240,
          height: 240,
          backgroundColor: "black",
        }}
        ref={remoteVideoRef}
        autoPlay
      />
    </div>
  );
}

export default Video;
