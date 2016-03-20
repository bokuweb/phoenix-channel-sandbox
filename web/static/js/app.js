import "../../../deps/phoenix_html/web/static/js/phoenix_html";
import Socket from "./socket";
import React from 'react';
import { render } from 'react-dom';

const socket = new Socket('/socket');
socket.connect('rooms:join', {});

setInterval(() => {
  console.log('send');
  socket.send();
}, 1000);

render(<h1>Hello, World!!</h1>, document.querySelector('#root'));
