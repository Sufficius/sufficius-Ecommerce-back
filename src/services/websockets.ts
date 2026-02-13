import {Server as SocketIOServer, Socket} from "socket.io";
import { FastifyInstance } from "fastify";


export default class RealTimeService {
    private io: SocketIOServer;
    constructor(fastify: FastifyInstance){
        this.io = new SocketIOServer(fastify.server);
        this.setupGlobalEvents();
    }

    private setupGlobalEvents(){
        this.io.on("connection", (socket: Socket) => {
            console.log(`Conectado: ${socket.id}`);
            socket.on("disconnect", () => {
                console.log(`Desconectado: ${socket.id}`);
            });
        });
    }
    emit(route: string, data: any){
        this.io.emit("sendData", {route, data});
    }
    getSocketIO(){
        return this.io;
    }
}