import { Socket } from "phoenix";

export default class SocketTest {
  constructor(endpoint, token) {
    this.socket = new Socket(endpoint, { params: { token }});
    this.socket.connect();
  }

  connect(topic, msg = {}) {
    this.channel = this.socket.channel(topic, msg)
    this.channel.join()
      .receive("ok", resp => console.log("Joined successfully", resp))
      .receive("error", resp =>  console.log("Unable to join", resp));

    this.channel.on("new:reply", message => console.log(message));
  }

  send() {
    this.channel.push("new:message", { msg: 'hoge' });
  }
}
