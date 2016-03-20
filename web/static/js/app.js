import "../../../deps/phoenix_html/web/static/js/phoenix_html";
import Socket from "./socket";
import React, { Component } from 'react';
import { render } from 'react-dom';

class Chat extends Component {
  constructor(props) {
    super(props);
    this.state = { messages: [] };
    this.socket = new Socket('/socket');
    this.socket.connect('rooms:join', {});
    this.socket.addListener("new:reply", messages => {
      this.setState({ messages: this.state.messages.concat(messages) });
    })
  }

  handleSubmit(e) {
    e.preventDefault();
    const message = this.refs.message.value.trim();
    if (!message) return;
    this.socket.send(message);
  }

  renderMessages() {
    return this.state.messages.map(message => <p>{message.msg}</p>);
  }

  render() {
    return (
      <div>
        <h1>Chat sample!!</h1>
        <form className="commentForm" onSubmit={this.handleSubmit.bind(this)}>
          <input type="text" ref="message" placeholder="message" />
          <input type="submit" value="Post" />
        </form>
        {this.renderMessages()}
      </div>

    );
  }
}

render(<Chat />, document.querySelector('#root'));
