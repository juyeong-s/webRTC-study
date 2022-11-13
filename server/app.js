import express from "express";
import http from "http";
import { Server } from "socket.io";
import indexRouter from "./routes/index.js";

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/", indexRouter);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 8080;

let users = {};
let socketRoom = {}; // socket.id 기준으로 어떤 방에 들어있는지 구분

// 방의 최대 인원수
const MAXIMUM = 2;

io.on("connection", (socket) => {
  console.log(socket.id, "connection");

  socket.on("join_room", (data) => {
    // 방이 기존에 생성되어 있을 경우
    if (users[data.room]) {
      // 현재 입장하려는 방에 있는 인원수
      // const currentRoomLength = users[data.room].length;
      // if (currentRoomLength === MAXIMUM) {
      //   // 인원수가 꽉 찼다면 돌아갑니다.
      //   socket.to(socket.id).emit("room_full");
      //   return;
      // }

      // 여분의 자리가 있다면 해당 방 배열에 추가
      users[data.room] = [...users[data.room], { id: socket.id }];
    } else {
      // 방이 존재하지 않을 경우, 값을 생성하고 추가
      users[data.room] = [{ id: socket.id }];
    }
    socketRoom[socket.id] = data.room;

    // 입장
    socket.join(data.room);

    // 입장하기 전 해당 방의 다른 유저들이 있는지 확인하고, 다른 유저가 있었다면 offer-answer을 위해 알려준다
    const others = users[data.room].filter((user) => user.id !== socket.id);
    if (others.length) {
      io.sockets.to(socket.id).emit("all_users", others);
    }
  });

  /* offer를 전달받고 다른 유저들에게 전달 */
  socket.on("offer", (sdp, roomName) => {
    socket.to(roomName).emit("getOffer", sdp);
  });

  /* answer를 전달받고 방의 다른 유저들에게 전달 */
  socket.on("answer", (sdp, roomName) => {
    socket.to(roomName).emit("getAnswer", sdp);
  });

  /* candidate를 전달받고 방의 다른 유저들에게 전달 */
  socket.on("candidate", (candidate, roomName) => {
    socket.to(roomName).emit("getCandidate", candidate);
  });

  /* 방을 나가게 될 경우 socketRoom과 users의 정보에서 해당 유저 제거 */
  socket.on("disconnect", () => {
    const roomID = socketRoom[socket.id];

    if (users[roomID]) {
      users[roomID] = users[roomID].filter((user) => user.id !== socket.id);
      if (users[roomID].length === 0) {
        return delete users[roomID];
      }
    }

    delete socketRoom[socket.id];
    // 모두에게 나갔다고 알려주기
    socket.broadcast.to(users[roomID]).emit("user_exit", { id: socket.id });
  });
});

server.listen(PORT, () => {
  console.log(`server running on ${PORT}`);
});
