(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

// Although ^=parent is not technically correct,
// we need to use it in order to get IE8 support.
var elements = document.querySelectorAll('[data-submit^=parent]');
var len = elements.length;

for (var i = 0; i < len; ++i) {
  elements[i].addEventListener('click', function (event) {
    var message = this.getAttribute("data-confirm");
    if (message === null || confirm(message)) {
      this.parentNode.submit();
    };
    event.preventDefault();
    return false;
  }, false);
}

},{}],2:[function(require,module,exports){
(function(exports){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Phoenix Channels JavaScript client
//
// ## Socket Connection
//
// A single connection is established to the server and
// channels are mulitplexed over the connection.
// Connect to the server using the `Socket` class:
//
//     let socket = new Socket("/ws", {params: {userToken: "123"}})
//     socket.connect()
//
// The `Socket` constructor takes the mount point of the socket,
// the authentication params, as well as options that can be found in
// the Socket docs, such as configuring the `LongPoll` transport, and
// heartbeat.
//
// ## Channels
//
// Channels are isolated, concurrent processes on the server that
// subscribe to topics and broker events between the client and server.
// To join a channel, you must provide the topic, and channel params for
// authorization. Here's an example chat room example where `"new_msg"`
// events are listened for, messages are pushed to the server, and
// the channel is joined with ok/error/timeout matches:
//
//     let channel = socket.channel("rooms:123", {token: roomToken})
//     channel.on("new_msg", msg => console.log("Got message", msg) )
//     $input.onEnter( e => {
//       channel.push("new_msg", {body: e.target.val}, 10000)
//        .receive("ok", (msg) => console.log("created message", msg) )
//        .receive("error", (reasons) => console.log("create failed", reasons) )
//        .receive("timeout", () => console.log("Networking issue...") )
//     })
//     channel.join()
//       .receive("ok", ({messages}) => console.log("catching up", messages) )
//       .receive("error", ({reason}) => console.log("failed join", reason) )
//       .receive("timeout", () => console.log("Networking issue. Still waiting...") )
//
//
// ## Joining
//
// Creating a channel with `socket.channel(topic, params)`, binds the params to
// `channel.params`, which are sent up on `channel.join()`.
// Subsequent rejoins will send up the modified params for
// updating authorization params, or passing up last_message_id information.
// Successful joins receive an "ok" status, while unsuccessful joins
// receive "error".
//
//
// ## Pushing Messages
//
// From the previous example, we can see that pushing messages to the server
// can be done with `channel.push(eventName, payload)` and we can optionally
// receive responses from the push. Additionally, we can use
// `receive("timeout", callback)` to abort waiting for our other `receive` hooks
//  and take action after some period of waiting. The default timeout is 5000ms.
//
//
// ## Socket Hooks
//
// Lifecycle events of the multiplexed connection can be hooked into via
// `socket.onError()` and `socket.onClose()` events, ie:
//
//     socket.onError( () => console.log("there was an error with the connection!") )
//     socket.onClose( () => console.log("the connection dropped") )
//
//
// ## Channel Hooks
//
// For each joined channel, you can bind to `onError` and `onClose` events
// to monitor the channel lifecycle, ie:
//
//     channel.onError( () => console.log("there was an error!") )
//     channel.onClose( () => console.log("the channel has gone away gracefully") )
//
// ### onError hooks
//
// `onError` hooks are invoked if the socket connection drops, or the channel
// crashes on the server. In either case, a channel rejoin is attemtped
// automatically in an exponential backoff manner.
//
// ### onClose hooks
//
// `onClose` hooks are invoked only in two cases. 1) the channel explicitly
// closed on the server, or 2). The client explicitly closed, by calling
// `channel.leave()`
//

var VSN = "1.0.0";
var SOCKET_STATES = { connecting: 0, open: 1, closing: 2, closed: 3 };
var DEFAULT_TIMEOUT = 10000;
var CHANNEL_STATES = {
  closed: "closed",
  errored: "errored",
  joined: "joined",
  joining: "joining"
};
var CHANNEL_EVENTS = {
  close: "phx_close",
  error: "phx_error",
  join: "phx_join",
  reply: "phx_reply",
  leave: "phx_leave"
};
var TRANSPORTS = {
  longpoll: "longpoll",
  websocket: "websocket"
};

var Push = function () {

  // Initializes the Push
  //
  // channel - The Channel
  // event - The event, for example `"phx_join"`
  // payload - The payload, for example `{user_id: 123}`
  // timeout - The push timeout in milliseconds
  //

  function Push(channel, event, payload, timeout) {
    _classCallCheck(this, Push);

    this.channel = channel;
    this.event = event;
    this.payload = payload || {};
    this.receivedResp = null;
    this.timeout = timeout;
    this.timeoutTimer = null;
    this.recHooks = [];
    this.sent = false;
  }

  _createClass(Push, [{
    key: "resend",
    value: function resend(timeout) {
      this.timeout = timeout;
      this.cancelRefEvent();
      this.ref = null;
      this.refEvent = null;
      this.receivedResp = null;
      this.sent = false;
      this.send();
    }
  }, {
    key: "send",
    value: function send() {
      if (this.hasReceived("timeout")) {
        return;
      }
      this.startTimeout();
      this.sent = true;
      this.channel.socket.push({
        topic: this.channel.topic,
        event: this.event,
        payload: this.payload,
        ref: this.ref
      });
    }
  }, {
    key: "receive",
    value: function receive(status, callback) {
      if (this.hasReceived(status)) {
        callback(this.receivedResp.response);
      }

      this.recHooks.push({ status: status, callback: callback });
      return this;
    }

    // private

  }, {
    key: "matchReceive",
    value: function matchReceive(_ref) {
      var status = _ref.status;
      var response = _ref.response;
      var ref = _ref.ref;

      this.recHooks.filter(function (h) {
        return h.status === status;
      }).forEach(function (h) {
        return h.callback(response);
      });
    }
  }, {
    key: "cancelRefEvent",
    value: function cancelRefEvent() {
      if (!this.refEvent) {
        return;
      }
      this.channel.off(this.refEvent);
    }
  }, {
    key: "cancelTimeout",
    value: function cancelTimeout() {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }, {
    key: "startTimeout",
    value: function startTimeout() {
      var _this = this;

      if (this.timeoutTimer) {
        return;
      }
      this.ref = this.channel.socket.makeRef();
      this.refEvent = this.channel.replyEventName(this.ref);

      this.channel.on(this.refEvent, function (payload) {
        _this.cancelRefEvent();
        _this.cancelTimeout();
        _this.receivedResp = payload;
        _this.matchReceive(payload);
      });

      this.timeoutTimer = setTimeout(function () {
        _this.trigger("timeout", {});
      }, this.timeout);
    }
  }, {
    key: "hasReceived",
    value: function hasReceived(status) {
      return this.receivedResp && this.receivedResp.status === status;
    }
  }, {
    key: "trigger",
    value: function trigger(status, response) {
      this.channel.trigger(this.refEvent, { status: status, response: response });
    }
  }]);

  return Push;
}();

var Channel = exports.Channel = function () {
  function Channel(topic, params, socket) {
    var _this2 = this;

    _classCallCheck(this, Channel);

    this.state = CHANNEL_STATES.closed;
    this.topic = topic;
    this.params = params || {};
    this.socket = socket;
    this.bindings = [];
    this.timeout = this.socket.timeout;
    this.joinedOnce = false;
    this.joinPush = new Push(this, CHANNEL_EVENTS.join, this.params, this.timeout);
    this.pushBuffer = [];
    this.rejoinTimer = new Timer(function () {
      return _this2.rejoinUntilConnected();
    }, this.socket.reconnectAfterMs);
    this.joinPush.receive("ok", function () {
      _this2.state = CHANNEL_STATES.joined;
      _this2.rejoinTimer.reset();
      _this2.pushBuffer.forEach(function (pushEvent) {
        return pushEvent.send();
      });
      _this2.pushBuffer = [];
    });
    this.onClose(function () {
      _this2.socket.log("channel", "close " + _this2.topic);
      _this2.state = CHANNEL_STATES.closed;
      _this2.socket.remove(_this2);
    });
    this.onError(function (reason) {
      _this2.socket.log("channel", "error " + _this2.topic, reason);
      _this2.state = CHANNEL_STATES.errored;
      _this2.rejoinTimer.scheduleTimeout();
    });
    this.joinPush.receive("timeout", function () {
      if (_this2.state !== CHANNEL_STATES.joining) {
        return;
      }

      _this2.socket.log("channel", "timeout " + _this2.topic, _this2.joinPush.timeout);
      _this2.state = CHANNEL_STATES.errored;
      _this2.rejoinTimer.scheduleTimeout();
    });
    this.on(CHANNEL_EVENTS.reply, function (payload, ref) {
      _this2.trigger(_this2.replyEventName(ref), payload);
    });
  }

  _createClass(Channel, [{
    key: "rejoinUntilConnected",
    value: function rejoinUntilConnected() {
      this.rejoinTimer.scheduleTimeout();
      if (this.socket.isConnected()) {
        this.rejoin();
      }
    }
  }, {
    key: "join",
    value: function join() {
      var timeout = arguments.length <= 0 || arguments[0] === undefined ? this.timeout : arguments[0];

      if (this.joinedOnce) {
        throw "tried to join multiple times. 'join' can only be called a single time per channel instance";
      } else {
        this.joinedOnce = true;
      }
      this.rejoin(timeout);
      return this.joinPush;
    }
  }, {
    key: "onClose",
    value: function onClose(callback) {
      this.on(CHANNEL_EVENTS.close, callback);
    }
  }, {
    key: "onError",
    value: function onError(callback) {
      this.on(CHANNEL_EVENTS.error, function (reason) {
        return callback(reason);
      });
    }
  }, {
    key: "on",
    value: function on(event, callback) {
      this.bindings.push({ event: event, callback: callback });
    }
  }, {
    key: "off",
    value: function off(event) {
      this.bindings = this.bindings.filter(function (bind) {
        return bind.event !== event;
      });
    }
  }, {
    key: "canPush",
    value: function canPush() {
      return this.socket.isConnected() && this.state === CHANNEL_STATES.joined;
    }
  }, {
    key: "push",
    value: function push(event, payload) {
      var timeout = arguments.length <= 2 || arguments[2] === undefined ? this.timeout : arguments[2];

      if (!this.joinedOnce) {
        throw "tried to push '" + event + "' to '" + this.topic + "' before joining. Use channel.join() before pushing events";
      }
      var pushEvent = new Push(this, event, payload, timeout);
      if (this.canPush()) {
        pushEvent.send();
      } else {
        pushEvent.startTimeout();
        this.pushBuffer.push(pushEvent);
      }

      return pushEvent;
    }

    // Leaves the channel
    //
    // Unsubscribes from server events, and
    // instructs channel to terminate on server
    //
    // Triggers onClose() hooks
    //
    // To receive leave acknowledgements, use the a `receive`
    // hook to bind to the server ack, ie:
    //
    //     channel.leave().receive("ok", () => alert("left!") )
    //

  }, {
    key: "leave",
    value: function leave() {
      var _this3 = this;

      var timeout = arguments.length <= 0 || arguments[0] === undefined ? this.timeout : arguments[0];

      var onClose = function onClose() {
        _this3.socket.log("channel", "leave " + _this3.topic);
        _this3.trigger(CHANNEL_EVENTS.close, "leave");
      };
      var leavePush = new Push(this, CHANNEL_EVENTS.leave, {}, timeout);
      leavePush.receive("ok", function () {
        return onClose();
      }).receive("timeout", function () {
        return onClose();
      });
      leavePush.send();
      if (!this.canPush()) {
        leavePush.trigger("ok", {});
      }

      return leavePush;
    }

    // Overridable message hook
    //
    // Receives all events for specialized message handling

  }, {
    key: "onMessage",
    value: function onMessage(event, payload, ref) {}

    // private

  }, {
    key: "isMember",
    value: function isMember(topic) {
      return this.topic === topic;
    }
  }, {
    key: "sendJoin",
    value: function sendJoin(timeout) {
      this.state = CHANNEL_STATES.joining;
      this.joinPush.resend(timeout);
    }
  }, {
    key: "rejoin",
    value: function rejoin() {
      var timeout = arguments.length <= 0 || arguments[0] === undefined ? this.timeout : arguments[0];
      this.sendJoin(timeout);
    }
  }, {
    key: "trigger",
    value: function trigger(triggerEvent, payload, ref) {
      this.onMessage(triggerEvent, payload, ref);
      this.bindings.filter(function (bind) {
        return bind.event === triggerEvent;
      }).map(function (bind) {
        return bind.callback(payload, ref);
      });
    }
  }, {
    key: "replyEventName",
    value: function replyEventName(ref) {
      return "chan_reply_" + ref;
    }
  }]);

  return Channel;
}();

var Socket = exports.Socket = function () {

  // Initializes the Socket
  //
  // endPoint - The string WebSocket endpoint, ie, "ws://example.com/ws",
  //                                               "wss://example.com"
  //                                               "/ws" (inherited host & protocol)
  // opts - Optional configuration
  //   transport - The Websocket Transport, for example WebSocket or Phoenix.LongPoll.
  //               Defaults to WebSocket with automatic LongPoll fallback.
  //   timeout - The default timeout in milliseconds to trigger push timeouts.
  //             Defaults `DEFAULT_TIMEOUT`
  //   heartbeatIntervalMs - The millisec interval to send a heartbeat message
  //   reconnectAfterMs - The optional function that returns the millsec
  //                      reconnect interval. Defaults to stepped backoff of:
  //
  //     function(tries){
  //       return [1000, 5000, 10000][tries - 1] || 10000
  //     }
  //
  //   logger - The optional function for specialized logging, ie:
  //     `logger: (kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }
  //
  //   longpollerTimeout - The maximum timeout of a long poll AJAX request.
  //                        Defaults to 20s (double the server long poll timer).
  //
  //   params - The optional params to pass when connecting
  //
  // For IE8 support use an ES5-shim (https://github.com/es-shims/es5-shim)
  //

  function Socket(endPoint) {
    var _this4 = this;

    var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Socket);

    this.stateChangeCallbacks = { open: [], close: [], error: [], message: [] };
    this.channels = [];
    this.sendBuffer = [];
    this.ref = 0;
    this.timeout = opts.timeout || DEFAULT_TIMEOUT;
    this.transport = opts.transport || window.WebSocket || LongPoll;
    this.heartbeatIntervalMs = opts.heartbeatIntervalMs || 30000;
    this.reconnectAfterMs = opts.reconnectAfterMs || function (tries) {
      return [1000, 2000, 5000, 10000][tries - 1] || 10000;
    };
    this.logger = opts.logger || function () {}; // noop
    this.longpollerTimeout = opts.longpollerTimeout || 20000;
    this.params = opts.params || {};
    this.endPoint = endPoint + "/" + TRANSPORTS.websocket;
    this.reconnectTimer = new Timer(function () {
      _this4.disconnect(function () {
        return _this4.connect();
      });
    }, this.reconnectAfterMs);
  }

  _createClass(Socket, [{
    key: "protocol",
    value: function protocol() {
      return location.protocol.match(/^https/) ? "wss" : "ws";
    }
  }, {
    key: "endPointURL",
    value: function endPointURL() {
      var uri = Ajax.appendParams(Ajax.appendParams(this.endPoint, this.params), { vsn: VSN });
      if (uri.charAt(0) !== "/") {
        return uri;
      }
      if (uri.charAt(1) === "/") {
        return this.protocol() + ":" + uri;
      }

      return this.protocol() + "://" + location.host + uri;
    }
  }, {
    key: "disconnect",
    value: function disconnect(callback, code, reason) {
      if (this.conn) {
        this.conn.onclose = function () {}; // noop
        if (code) {
          this.conn.close(code, reason || "");
        } else {
          this.conn.close();
        }
        this.conn = null;
      }
      callback && callback();
    }

    // params - The params to send when connecting, for example `{user_id: userToken}`

  }, {
    key: "connect",
    value: function connect(params) {
      var _this5 = this;

      if (params) {
        console && console.log("passing params to connect is deprecated. Instead pass :params to the Socket constructor");
        this.params = params;
      }
      if (this.conn) {
        return;
      }

      this.conn = new this.transport(this.endPointURL());
      this.conn.timeout = this.longpollerTimeout;
      this.conn.onopen = function () {
        return _this5.onConnOpen();
      };
      this.conn.onerror = function (error) {
        return _this5.onConnError(error);
      };
      this.conn.onmessage = function (event) {
        return _this5.onConnMessage(event);
      };
      this.conn.onclose = function (event) {
        return _this5.onConnClose(event);
      };
    }

    // Logs the message. Override `this.logger` for specialized logging. noops by default

  }, {
    key: "log",
    value: function log(kind, msg, data) {
      this.logger(kind, msg, data);
    }

    // Registers callbacks for connection state change events
    //
    // Examples
    //
    //    socket.onError(function(error){ alert("An error occurred") })
    //

  }, {
    key: "onOpen",
    value: function onOpen(callback) {
      this.stateChangeCallbacks.open.push(callback);
    }
  }, {
    key: "onClose",
    value: function onClose(callback) {
      this.stateChangeCallbacks.close.push(callback);
    }
  }, {
    key: "onError",
    value: function onError(callback) {
      this.stateChangeCallbacks.error.push(callback);
    }
  }, {
    key: "onMessage",
    value: function onMessage(callback) {
      this.stateChangeCallbacks.message.push(callback);
    }
  }, {
    key: "onConnOpen",
    value: function onConnOpen() {
      var _this6 = this;

      this.log("transport", "connected to " + this.endPointURL(), this.transport.prototype);
      this.flushSendBuffer();
      this.reconnectTimer.reset();
      if (!this.conn.skipHeartbeat) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(function () {
          return _this6.sendHeartbeat();
        }, this.heartbeatIntervalMs);
      }
      this.stateChangeCallbacks.open.forEach(function (callback) {
        return callback();
      });
    }
  }, {
    key: "onConnClose",
    value: function onConnClose(event) {
      this.log("transport", "close", event);
      this.triggerChanError();
      clearInterval(this.heartbeatTimer);
      this.reconnectTimer.scheduleTimeout();
      this.stateChangeCallbacks.close.forEach(function (callback) {
        return callback(event);
      });
    }
  }, {
    key: "onConnError",
    value: function onConnError(error) {
      this.log("transport", error);
      this.triggerChanError();
      this.stateChangeCallbacks.error.forEach(function (callback) {
        return callback(error);
      });
    }
  }, {
    key: "triggerChanError",
    value: function triggerChanError() {
      this.channels.forEach(function (channel) {
        return channel.trigger(CHANNEL_EVENTS.error);
      });
    }
  }, {
    key: "connectionState",
    value: function connectionState() {
      switch (this.conn && this.conn.readyState) {
        case SOCKET_STATES.connecting:
          return "connecting";
        case SOCKET_STATES.open:
          return "open";
        case SOCKET_STATES.closing:
          return "closing";
        default:
          return "closed";
      }
    }
  }, {
    key: "isConnected",
    value: function isConnected() {
      return this.connectionState() === "open";
    }
  }, {
    key: "remove",
    value: function remove(channel) {
      this.channels = this.channels.filter(function (c) {
        return !c.isMember(channel.topic);
      });
    }
  }, {
    key: "channel",
    value: function channel(topic) {
      var chanParams = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var chan = new Channel(topic, chanParams, this);
      this.channels.push(chan);
      return chan;
    }
  }, {
    key: "push",
    value: function push(data) {
      var _this7 = this;

      var topic = data.topic;
      var event = data.event;
      var payload = data.payload;
      var ref = data.ref;

      var callback = function callback() {
        return _this7.conn.send(JSON.stringify(data));
      };
      this.log("push", topic + " " + event + " (" + ref + ")", payload);
      if (this.isConnected()) {
        callback();
      } else {
        this.sendBuffer.push(callback);
      }
    }

    // Return the next message ref, accounting for overflows

  }, {
    key: "makeRef",
    value: function makeRef() {
      var newRef = this.ref + 1;
      if (newRef === this.ref) {
        this.ref = 0;
      } else {
        this.ref = newRef;
      }

      return this.ref.toString();
    }
  }, {
    key: "sendHeartbeat",
    value: function sendHeartbeat() {
      if (!this.isConnected()) {
        return;
      }
      this.push({ topic: "phoenix", event: "heartbeat", payload: {}, ref: this.makeRef() });
    }
  }, {
    key: "flushSendBuffer",
    value: function flushSendBuffer() {
      if (this.isConnected() && this.sendBuffer.length > 0) {
        this.sendBuffer.forEach(function (callback) {
          return callback();
        });
        this.sendBuffer = [];
      }
    }
  }, {
    key: "onConnMessage",
    value: function onConnMessage(rawMessage) {
      var msg = JSON.parse(rawMessage.data);
      var topic = msg.topic;
      var event = msg.event;
      var payload = msg.payload;
      var ref = msg.ref;

      this.log("receive", (payload.status || "") + " " + topic + " " + event + " " + (ref && "(" + ref + ")" || ""), payload);
      this.channels.filter(function (channel) {
        return channel.isMember(topic);
      }).forEach(function (channel) {
        return channel.trigger(event, payload, ref);
      });
      this.stateChangeCallbacks.message.forEach(function (callback) {
        return callback(msg);
      });
    }
  }]);

  return Socket;
}();

var LongPoll = exports.LongPoll = function () {
  function LongPoll(endPoint) {
    _classCallCheck(this, LongPoll);

    this.endPoint = null;
    this.token = null;
    this.skipHeartbeat = true;
    this.onopen = function () {}; // noop
    this.onerror = function () {}; // noop
    this.onmessage = function () {}; // noop
    this.onclose = function () {}; // noop
    this.pollEndpoint = this.normalizeEndpoint(endPoint);
    this.readyState = SOCKET_STATES.connecting;

    this.poll();
  }

  _createClass(LongPoll, [{
    key: "normalizeEndpoint",
    value: function normalizeEndpoint(endPoint) {
      return endPoint.replace("ws://", "http://").replace("wss://", "https://").replace(new RegExp("(.*)\/" + TRANSPORTS.websocket), "$1/" + TRANSPORTS.longpoll);
    }
  }, {
    key: "endpointURL",
    value: function endpointURL() {
      return Ajax.appendParams(this.pollEndpoint, { token: this.token });
    }
  }, {
    key: "closeAndRetry",
    value: function closeAndRetry() {
      this.close();
      this.readyState = SOCKET_STATES.connecting;
    }
  }, {
    key: "ontimeout",
    value: function ontimeout() {
      this.onerror("timeout");
      this.closeAndRetry();
    }
  }, {
    key: "poll",
    value: function poll() {
      var _this8 = this;

      if (!(this.readyState === SOCKET_STATES.open || this.readyState === SOCKET_STATES.connecting)) {
        return;
      }

      Ajax.request("GET", this.endpointURL(), "application/json", null, this.timeout, this.ontimeout.bind(this), function (resp) {
        if (resp) {
          var status = resp.status;
          var token = resp.token;
          var messages = resp.messages;

          _this8.token = token;
        } else {
          var status = 0;
        }

        switch (status) {
          case 200:
            messages.forEach(function (msg) {
              return _this8.onmessage({ data: JSON.stringify(msg) });
            });
            _this8.poll();
            break;
          case 204:
            _this8.poll();
            break;
          case 410:
            _this8.readyState = SOCKET_STATES.open;
            _this8.onopen();
            _this8.poll();
            break;
          case 0:
          case 500:
            _this8.onerror();
            _this8.closeAndRetry();
            break;
          default:
            throw "unhandled poll status " + status;
        }
      });
    }
  }, {
    key: "send",
    value: function send(body) {
      var _this9 = this;

      Ajax.request("POST", this.endpointURL(), "application/json", body, this.timeout, this.onerror.bind(this, "timeout"), function (resp) {
        if (!resp || resp.status !== 200) {
          _this9.onerror(status);
          _this9.closeAndRetry();
        }
      });
    }
  }, {
    key: "close",
    value: function close(code, reason) {
      this.readyState = SOCKET_STATES.closed;
      this.onclose();
    }
  }]);

  return LongPoll;
}();

var Ajax = exports.Ajax = function () {
  function Ajax() {
    _classCallCheck(this, Ajax);
  }

  _createClass(Ajax, null, [{
    key: "request",
    value: function request(method, endPoint, accept, body, timeout, ontimeout, callback) {
      if (window.XDomainRequest) {
        var req = new XDomainRequest(); // IE8, IE9
        this.xdomainRequest(req, method, endPoint, body, timeout, ontimeout, callback);
      } else {
        var req = window.XMLHttpRequest ? new XMLHttpRequest() : // IE7+, Firefox, Chrome, Opera, Safari
        new ActiveXObject("Microsoft.XMLHTTP"); // IE6, IE5
        this.xhrRequest(req, method, endPoint, accept, body, timeout, ontimeout, callback);
      }
    }
  }, {
    key: "xdomainRequest",
    value: function xdomainRequest(req, method, endPoint, body, timeout, ontimeout, callback) {
      var _this10 = this;

      req.timeout = timeout;
      req.open(method, endPoint);
      req.onload = function () {
        var response = _this10.parseJSON(req.responseText);
        callback && callback(response);
      };
      if (ontimeout) {
        req.ontimeout = ontimeout;
      }

      // Work around bug in IE9 that requires an attached onprogress handler
      req.onprogress = function () {};

      req.send(body);
    }
  }, {
    key: "xhrRequest",
    value: function xhrRequest(req, method, endPoint, accept, body, timeout, ontimeout, callback) {
      var _this11 = this;

      req.timeout = timeout;
      req.open(method, endPoint, true);
      req.setRequestHeader("Content-Type", accept);
      req.onerror = function () {
        callback && callback(null);
      };
      req.onreadystatechange = function () {
        if (req.readyState === _this11.states.complete && callback) {
          var response = _this11.parseJSON(req.responseText);
          callback(response);
        }
      };
      if (ontimeout) {
        req.ontimeout = ontimeout;
      }

      req.send(body);
    }
  }, {
    key: "parseJSON",
    value: function parseJSON(resp) {
      return resp && resp !== "" ? JSON.parse(resp) : null;
    }
  }, {
    key: "serialize",
    value: function serialize(obj, parentKey) {
      var queryStr = [];
      for (var key in obj) {
        if (!obj.hasOwnProperty(key)) {
          continue;
        }
        var paramKey = parentKey ? parentKey + "[" + key + "]" : key;
        var paramVal = obj[key];
        if ((typeof paramVal === "undefined" ? "undefined" : _typeof(paramVal)) === "object") {
          queryStr.push(this.serialize(paramVal, paramKey));
        } else {
          queryStr.push(encodeURIComponent(paramKey) + "=" + encodeURIComponent(paramVal));
        }
      }
      return queryStr.join("&");
    }
  }, {
    key: "appendParams",
    value: function appendParams(url, params) {
      if (Object.keys(params).length === 0) {
        return url;
      }

      var prefix = url.match(/\?/) ? "&" : "?";
      return "" + url + prefix + this.serialize(params);
    }
  }]);

  return Ajax;
}();

Ajax.states = { complete: 4 };

// Creates a timer that accepts a `timerCalc` function to perform
// calculated timeout retries, such as exponential backoff.
//
// ## Examples
//
//    let reconnectTimer = new Timer(() => this.connect(), function(tries){
//      return [1000, 5000, 10000][tries - 1] || 10000
//    })
//    reconnectTimer.scheduleTimeout() // fires after 1000
//    reconnectTimer.scheduleTimeout() // fires after 5000
//    reconnectTimer.reset()
//    reconnectTimer.scheduleTimeout() // fires after 1000
//

var Timer = function () {
  function Timer(callback, timerCalc) {
    _classCallCheck(this, Timer);

    this.callback = callback;
    this.timerCalc = timerCalc;
    this.timer = null;
    this.tries = 0;
  }

  _createClass(Timer, [{
    key: "reset",
    value: function reset() {
      this.tries = 0;
      clearTimeout(this.timer);
    }

    // Cancels any previous scheduleTimeout and schedules callback

  }, {
    key: "scheduleTimeout",
    value: function scheduleTimeout() {
      var _this12 = this;

      clearTimeout(this.timer);

      this.timer = setTimeout(function () {
        _this12.tries = _this12.tries + 1;
        _this12.callback();
      }, this.timerCalc(this.tries + 1));
    }
  }]);

  return Timer;
}();


})(typeof(exports) === "undefined" ? window.Phoenix = window.Phoenix || {} : exports);

},{}],3:[function(require,module,exports){
"use strict";

require("../../../deps/phoenix_html/web/static/js/phoenix_html");

var _socket = require("./socket");

var _socket2 = _interopRequireDefault(_socket);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"../../../deps/phoenix_html/web/static/js/phoenix_html":1,"./socket":4}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _phoenix = require("phoenix");

var socket = new _phoenix.Socket("/socket", { params: { token: window.userToken } });

// When you connect, you'll often need to authenticate the client.
// For example, imagine you have an authentication plug, `MyAuth`,
// which authenticates the session and assigns a `:current_user`.
// If the current user exists you can assign the user's token in
// the connection for use in the layout.
//
// In your "web/router.ex":
//
//     pipeline :browser do
//       ...
//       plug MyAuth
//       plug :put_user_token
//     end
//
//     defp put_user_token(conn, _) do
//       if current_user = conn.assigns[:current_user] do
//         token = Phoenix.Token.sign(conn, "user socket", current_user.id)
//         assign(conn, :user_token, token)
//       else
//         conn
//       end
//     end
//
// Now you need to pass this token to JavaScript. You can do so
// inside a script tag in "web/templates/layout/app.html.eex":
//
//     <script>window.userToken = "<%= assigns[:user_token] %>";</script>
//
// You will need to verify the user token in the "connect/2" function
// in "web/channels/user_socket.ex":
//
//     def connect(%{"token" => token}, socket) do
//       # max_age: 1209600 is equivalent to two weeks in seconds
//       case Phoenix.Token.verify(socket, "user socket", token, max_age: 1209600) do
//         {:ok, user_id} ->
//           {:ok, assign(socket, :user, user_id)}
//         {:error, reason} ->
//           :error
//       end
//     end
//
// Finally, pass the token on connect as below. Or remove it
// from connect if you don't care about authentication.

// NOTE: The contents of this file will only be executed if
// you uncomment its entry in "web/static/js/app.js".

// To use Phoenix channels, the first step is to import Socket
// and connect at the socket path in "lib/my_app/endpoint.ex":
socket.connect();

// Now that you are connected, you can join channels with a topic:
var channel = socket.channel("rooms:join", {});
channel.join().receive("ok", function (resp) {
  console.log("Joined successfully", resp);
}).receive("error", function (resp) {
  console.log("Unable to join", resp);
});

exports.default = socket;

},{"phoenix":2}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXBzL3Bob2VuaXhfaHRtbC93ZWIvc3RhdGljL2pzL3Bob2VuaXhfaHRtbC5qcyIsIm5vZGVfbW9kdWxlcy9waG9lbml4L3ByaXYvc3RhdGljL3Bob2VuaXguanMiLCJ3ZWIvc3RhdGljL2pzL2FwcC5qcyIsIndlYi9zdGF0aWMvanMvc29ja2V0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7OztBQ0VBLElBQUksV0FBVyxTQUFTLGdCQUFULENBQTBCLHVCQUExQixDQUFYO0FBQ0osSUFBSSxNQUFNLFNBQVMsTUFBVDs7QUFFVixLQUFLLElBQUksSUFBRSxDQUFGLEVBQUssSUFBRSxHQUFGLEVBQU8sRUFBRSxDQUFGLEVBQUs7QUFDeEIsV0FBUyxDQUFULEVBQVksZ0JBQVosQ0FBNkIsT0FBN0IsRUFBc0MsVUFBUyxLQUFULEVBQWU7QUFDbkQsUUFBSSxVQUFVLEtBQUssWUFBTCxDQUFrQixjQUFsQixDQUFWLENBRCtDO0FBRW5ELFFBQUcsWUFBWSxJQUFaLElBQW9CLFFBQVEsT0FBUixDQUFwQixFQUFxQztBQUN0QyxXQUFLLFVBQUwsQ0FBZ0IsTUFBaEIsR0FEc0M7S0FBeEMsQ0FGbUQ7QUFLbkQsVUFBTSxjQUFOLEdBTG1EO0FBTW5ELFdBQU8sS0FBUCxDQU5tRDtHQUFmLEVBT25DLEtBUEgsRUFEd0I7Q0FBMUI7OztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbGdDQTs7QUFDQTs7Ozs7Ozs7Ozs7OztBQ0lBOztBQUVBLElBQUksU0FBUyxvQkFBVyxTQUFYLEVBQXNCLEVBQUMsUUFBUSxFQUFDLE9BQU8sT0FBTyxTQUFQLEVBQWhCLEVBQXZCLENBQVQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQThDSixPQUFPLE9BQVA7OztBQUdBLElBQUksVUFBVSxPQUFPLE9BQVAsQ0FBZSxZQUFmLEVBQTZCLEVBQTdCLENBQVY7QUFDSixRQUFRLElBQVIsR0FDRyxPQURILENBQ1csSUFEWCxFQUNpQixnQkFBUTtBQUFFLFVBQVEsR0FBUixDQUFZLHFCQUFaLEVBQW1DLElBQW5DLEVBQUY7Q0FBUixDQURqQixDQUVHLE9BRkgsQ0FFVyxPQUZYLEVBRW9CLGdCQUFRO0FBQUUsVUFBUSxHQUFSLENBQVksZ0JBQVosRUFBOEIsSUFBOUIsRUFBRjtDQUFSLENBRnBCOztrQkFJZSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBBbHRob3VnaCBePXBhcmVudCBpcyBub3QgdGVjaG5pY2FsbHkgY29ycmVjdCxcbi8vIHdlIG5lZWQgdG8gdXNlIGl0IGluIG9yZGVyIHRvIGdldCBJRTggc3VwcG9ydC5cbnZhciBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN1Ym1pdF49cGFyZW50XScpXG52YXIgbGVuID0gZWxlbWVudHMubGVuZ3RoXG5cbmZvciAodmFyIGk9MDsgaTxsZW47ICsraSkge1xuICBlbGVtZW50c1tpXS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICB2YXIgbWVzc2FnZSA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiZGF0YS1jb25maXJtXCIpXG4gICAgaWYobWVzc2FnZSA9PT0gbnVsbCB8fCBjb25maXJtKG1lc3NhZ2UpKXtcbiAgICAgIHRoaXMucGFyZW50Tm9kZS5zdWJtaXQoKVxuICAgIH07XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgIHJldHVybiBmYWxzZVxuICB9LCBmYWxzZSlcbn1cbiIsIihmdW5jdGlvbihleHBvcnRzKXtcblwidXNlIHN0cmljdFwiO1xuXG52YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gdHlwZW9mIG9iajsgfSA6IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0oKTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxuLy8gUGhvZW5peCBDaGFubmVscyBKYXZhU2NyaXB0IGNsaWVudFxuLy9cbi8vICMjIFNvY2tldCBDb25uZWN0aW9uXG4vL1xuLy8gQSBzaW5nbGUgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZCB0byB0aGUgc2VydmVyIGFuZFxuLy8gY2hhbm5lbHMgYXJlIG11bGl0cGxleGVkIG92ZXIgdGhlIGNvbm5lY3Rpb24uXG4vLyBDb25uZWN0IHRvIHRoZSBzZXJ2ZXIgdXNpbmcgdGhlIGBTb2NrZXRgIGNsYXNzOlxuLy9cbi8vICAgICBsZXQgc29ja2V0ID0gbmV3IFNvY2tldChcIi93c1wiLCB7cGFyYW1zOiB7dXNlclRva2VuOiBcIjEyM1wifX0pXG4vLyAgICAgc29ja2V0LmNvbm5lY3QoKVxuLy9cbi8vIFRoZSBgU29ja2V0YCBjb25zdHJ1Y3RvciB0YWtlcyB0aGUgbW91bnQgcG9pbnQgb2YgdGhlIHNvY2tldCxcbi8vIHRoZSBhdXRoZW50aWNhdGlvbiBwYXJhbXMsIGFzIHdlbGwgYXMgb3B0aW9ucyB0aGF0IGNhbiBiZSBmb3VuZCBpblxuLy8gdGhlIFNvY2tldCBkb2NzLCBzdWNoIGFzIGNvbmZpZ3VyaW5nIHRoZSBgTG9uZ1BvbGxgIHRyYW5zcG9ydCwgYW5kXG4vLyBoZWFydGJlYXQuXG4vL1xuLy8gIyMgQ2hhbm5lbHNcbi8vXG4vLyBDaGFubmVscyBhcmUgaXNvbGF0ZWQsIGNvbmN1cnJlbnQgcHJvY2Vzc2VzIG9uIHRoZSBzZXJ2ZXIgdGhhdFxuLy8gc3Vic2NyaWJlIHRvIHRvcGljcyBhbmQgYnJva2VyIGV2ZW50cyBiZXR3ZWVuIHRoZSBjbGllbnQgYW5kIHNlcnZlci5cbi8vIFRvIGpvaW4gYSBjaGFubmVsLCB5b3UgbXVzdCBwcm92aWRlIHRoZSB0b3BpYywgYW5kIGNoYW5uZWwgcGFyYW1zIGZvclxuLy8gYXV0aG9yaXphdGlvbi4gSGVyZSdzIGFuIGV4YW1wbGUgY2hhdCByb29tIGV4YW1wbGUgd2hlcmUgYFwibmV3X21zZ1wiYFxuLy8gZXZlbnRzIGFyZSBsaXN0ZW5lZCBmb3IsIG1lc3NhZ2VzIGFyZSBwdXNoZWQgdG8gdGhlIHNlcnZlciwgYW5kXG4vLyB0aGUgY2hhbm5lbCBpcyBqb2luZWQgd2l0aCBvay9lcnJvci90aW1lb3V0IG1hdGNoZXM6XG4vL1xuLy8gICAgIGxldCBjaGFubmVsID0gc29ja2V0LmNoYW5uZWwoXCJyb29tczoxMjNcIiwge3Rva2VuOiByb29tVG9rZW59KVxuLy8gICAgIGNoYW5uZWwub24oXCJuZXdfbXNnXCIsIG1zZyA9PiBjb25zb2xlLmxvZyhcIkdvdCBtZXNzYWdlXCIsIG1zZykgKVxuLy8gICAgICRpbnB1dC5vbkVudGVyKCBlID0+IHtcbi8vICAgICAgIGNoYW5uZWwucHVzaChcIm5ld19tc2dcIiwge2JvZHk6IGUudGFyZ2V0LnZhbH0sIDEwMDAwKVxuLy8gICAgICAgIC5yZWNlaXZlKFwib2tcIiwgKG1zZykgPT4gY29uc29sZS5sb2coXCJjcmVhdGVkIG1lc3NhZ2VcIiwgbXNnKSApXG4vLyAgICAgICAgLnJlY2VpdmUoXCJlcnJvclwiLCAocmVhc29ucykgPT4gY29uc29sZS5sb2coXCJjcmVhdGUgZmFpbGVkXCIsIHJlYXNvbnMpIClcbi8vICAgICAgICAucmVjZWl2ZShcInRpbWVvdXRcIiwgKCkgPT4gY29uc29sZS5sb2coXCJOZXR3b3JraW5nIGlzc3VlLi4uXCIpIClcbi8vICAgICB9KVxuLy8gICAgIGNoYW5uZWwuam9pbigpXG4vLyAgICAgICAucmVjZWl2ZShcIm9rXCIsICh7bWVzc2FnZXN9KSA9PiBjb25zb2xlLmxvZyhcImNhdGNoaW5nIHVwXCIsIG1lc3NhZ2VzKSApXG4vLyAgICAgICAucmVjZWl2ZShcImVycm9yXCIsICh7cmVhc29ufSkgPT4gY29uc29sZS5sb2coXCJmYWlsZWQgam9pblwiLCByZWFzb24pIClcbi8vICAgICAgIC5yZWNlaXZlKFwidGltZW91dFwiLCAoKSA9PiBjb25zb2xlLmxvZyhcIk5ldHdvcmtpbmcgaXNzdWUuIFN0aWxsIHdhaXRpbmcuLi5cIikgKVxuLy9cbi8vXG4vLyAjIyBKb2luaW5nXG4vL1xuLy8gQ3JlYXRpbmcgYSBjaGFubmVsIHdpdGggYHNvY2tldC5jaGFubmVsKHRvcGljLCBwYXJhbXMpYCwgYmluZHMgdGhlIHBhcmFtcyB0b1xuLy8gYGNoYW5uZWwucGFyYW1zYCwgd2hpY2ggYXJlIHNlbnQgdXAgb24gYGNoYW5uZWwuam9pbigpYC5cbi8vIFN1YnNlcXVlbnQgcmVqb2lucyB3aWxsIHNlbmQgdXAgdGhlIG1vZGlmaWVkIHBhcmFtcyBmb3Jcbi8vIHVwZGF0aW5nIGF1dGhvcml6YXRpb24gcGFyYW1zLCBvciBwYXNzaW5nIHVwIGxhc3RfbWVzc2FnZV9pZCBpbmZvcm1hdGlvbi5cbi8vIFN1Y2Nlc3NmdWwgam9pbnMgcmVjZWl2ZSBhbiBcIm9rXCIgc3RhdHVzLCB3aGlsZSB1bnN1Y2Nlc3NmdWwgam9pbnNcbi8vIHJlY2VpdmUgXCJlcnJvclwiLlxuLy9cbi8vXG4vLyAjIyBQdXNoaW5nIE1lc3NhZ2VzXG4vL1xuLy8gRnJvbSB0aGUgcHJldmlvdXMgZXhhbXBsZSwgd2UgY2FuIHNlZSB0aGF0IHB1c2hpbmcgbWVzc2FnZXMgdG8gdGhlIHNlcnZlclxuLy8gY2FuIGJlIGRvbmUgd2l0aCBgY2hhbm5lbC5wdXNoKGV2ZW50TmFtZSwgcGF5bG9hZClgIGFuZCB3ZSBjYW4gb3B0aW9uYWxseVxuLy8gcmVjZWl2ZSByZXNwb25zZXMgZnJvbSB0aGUgcHVzaC4gQWRkaXRpb25hbGx5LCB3ZSBjYW4gdXNlXG4vLyBgcmVjZWl2ZShcInRpbWVvdXRcIiwgY2FsbGJhY2spYCB0byBhYm9ydCB3YWl0aW5nIGZvciBvdXIgb3RoZXIgYHJlY2VpdmVgIGhvb2tzXG4vLyAgYW5kIHRha2UgYWN0aW9uIGFmdGVyIHNvbWUgcGVyaW9kIG9mIHdhaXRpbmcuIFRoZSBkZWZhdWx0IHRpbWVvdXQgaXMgNTAwMG1zLlxuLy9cbi8vXG4vLyAjIyBTb2NrZXQgSG9va3Ncbi8vXG4vLyBMaWZlY3ljbGUgZXZlbnRzIG9mIHRoZSBtdWx0aXBsZXhlZCBjb25uZWN0aW9uIGNhbiBiZSBob29rZWQgaW50byB2aWFcbi8vIGBzb2NrZXQub25FcnJvcigpYCBhbmQgYHNvY2tldC5vbkNsb3NlKClgIGV2ZW50cywgaWU6XG4vL1xuLy8gICAgIHNvY2tldC5vbkVycm9yKCAoKSA9PiBjb25zb2xlLmxvZyhcInRoZXJlIHdhcyBhbiBlcnJvciB3aXRoIHRoZSBjb25uZWN0aW9uIVwiKSApXG4vLyAgICAgc29ja2V0Lm9uQ2xvc2UoICgpID0+IGNvbnNvbGUubG9nKFwidGhlIGNvbm5lY3Rpb24gZHJvcHBlZFwiKSApXG4vL1xuLy9cbi8vICMjIENoYW5uZWwgSG9va3Ncbi8vXG4vLyBGb3IgZWFjaCBqb2luZWQgY2hhbm5lbCwgeW91IGNhbiBiaW5kIHRvIGBvbkVycm9yYCBhbmQgYG9uQ2xvc2VgIGV2ZW50c1xuLy8gdG8gbW9uaXRvciB0aGUgY2hhbm5lbCBsaWZlY3ljbGUsIGllOlxuLy9cbi8vICAgICBjaGFubmVsLm9uRXJyb3IoICgpID0+IGNvbnNvbGUubG9nKFwidGhlcmUgd2FzIGFuIGVycm9yIVwiKSApXG4vLyAgICAgY2hhbm5lbC5vbkNsb3NlKCAoKSA9PiBjb25zb2xlLmxvZyhcInRoZSBjaGFubmVsIGhhcyBnb25lIGF3YXkgZ3JhY2VmdWxseVwiKSApXG4vL1xuLy8gIyMjIG9uRXJyb3IgaG9va3Ncbi8vXG4vLyBgb25FcnJvcmAgaG9va3MgYXJlIGludm9rZWQgaWYgdGhlIHNvY2tldCBjb25uZWN0aW9uIGRyb3BzLCBvciB0aGUgY2hhbm5lbFxuLy8gY3Jhc2hlcyBvbiB0aGUgc2VydmVyLiBJbiBlaXRoZXIgY2FzZSwgYSBjaGFubmVsIHJlam9pbiBpcyBhdHRlbXRwZWRcbi8vIGF1dG9tYXRpY2FsbHkgaW4gYW4gZXhwb25lbnRpYWwgYmFja29mZiBtYW5uZXIuXG4vL1xuLy8gIyMjIG9uQ2xvc2UgaG9va3Ncbi8vXG4vLyBgb25DbG9zZWAgaG9va3MgYXJlIGludm9rZWQgb25seSBpbiB0d28gY2FzZXMuIDEpIHRoZSBjaGFubmVsIGV4cGxpY2l0bHlcbi8vIGNsb3NlZCBvbiB0aGUgc2VydmVyLCBvciAyKS4gVGhlIGNsaWVudCBleHBsaWNpdGx5IGNsb3NlZCwgYnkgY2FsbGluZ1xuLy8gYGNoYW5uZWwubGVhdmUoKWBcbi8vXG5cbnZhciBWU04gPSBcIjEuMC4wXCI7XG52YXIgU09DS0VUX1NUQVRFUyA9IHsgY29ubmVjdGluZzogMCwgb3BlbjogMSwgY2xvc2luZzogMiwgY2xvc2VkOiAzIH07XG52YXIgREVGQVVMVF9USU1FT1VUID0gMTAwMDA7XG52YXIgQ0hBTk5FTF9TVEFURVMgPSB7XG4gIGNsb3NlZDogXCJjbG9zZWRcIixcbiAgZXJyb3JlZDogXCJlcnJvcmVkXCIsXG4gIGpvaW5lZDogXCJqb2luZWRcIixcbiAgam9pbmluZzogXCJqb2luaW5nXCJcbn07XG52YXIgQ0hBTk5FTF9FVkVOVFMgPSB7XG4gIGNsb3NlOiBcInBoeF9jbG9zZVwiLFxuICBlcnJvcjogXCJwaHhfZXJyb3JcIixcbiAgam9pbjogXCJwaHhfam9pblwiLFxuICByZXBseTogXCJwaHhfcmVwbHlcIixcbiAgbGVhdmU6IFwicGh4X2xlYXZlXCJcbn07XG52YXIgVFJBTlNQT1JUUyA9IHtcbiAgbG9uZ3BvbGw6IFwibG9uZ3BvbGxcIixcbiAgd2Vic29ja2V0OiBcIndlYnNvY2tldFwiXG59O1xuXG52YXIgUHVzaCA9IGZ1bmN0aW9uICgpIHtcblxuICAvLyBJbml0aWFsaXplcyB0aGUgUHVzaFxuICAvL1xuICAvLyBjaGFubmVsIC0gVGhlIENoYW5uZWxcbiAgLy8gZXZlbnQgLSBUaGUgZXZlbnQsIGZvciBleGFtcGxlIGBcInBoeF9qb2luXCJgXG4gIC8vIHBheWxvYWQgLSBUaGUgcGF5bG9hZCwgZm9yIGV4YW1wbGUgYHt1c2VyX2lkOiAxMjN9YFxuICAvLyB0aW1lb3V0IC0gVGhlIHB1c2ggdGltZW91dCBpbiBtaWxsaXNlY29uZHNcbiAgLy9cblxuICBmdW5jdGlvbiBQdXNoKGNoYW5uZWwsIGV2ZW50LCBwYXlsb2FkLCB0aW1lb3V0KSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFB1c2gpO1xuXG4gICAgdGhpcy5jaGFubmVsID0gY2hhbm5lbDtcbiAgICB0aGlzLmV2ZW50ID0gZXZlbnQ7XG4gICAgdGhpcy5wYXlsb2FkID0gcGF5bG9hZCB8fCB7fTtcbiAgICB0aGlzLnJlY2VpdmVkUmVzcCA9IG51bGw7XG4gICAgdGhpcy50aW1lb3V0ID0gdGltZW91dDtcbiAgICB0aGlzLnRpbWVvdXRUaW1lciA9IG51bGw7XG4gICAgdGhpcy5yZWNIb29rcyA9IFtdO1xuICAgIHRoaXMuc2VudCA9IGZhbHNlO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFB1c2gsIFt7XG4gICAga2V5OiBcInJlc2VuZFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZXNlbmQodGltZW91dCkge1xuICAgICAgdGhpcy50aW1lb3V0ID0gdGltZW91dDtcbiAgICAgIHRoaXMuY2FuY2VsUmVmRXZlbnQoKTtcbiAgICAgIHRoaXMucmVmID0gbnVsbDtcbiAgICAgIHRoaXMucmVmRXZlbnQgPSBudWxsO1xuICAgICAgdGhpcy5yZWNlaXZlZFJlc3AgPSBudWxsO1xuICAgICAgdGhpcy5zZW50ID0gZmFsc2U7XG4gICAgICB0aGlzLnNlbmQoKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwic2VuZFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzZW5kKCkge1xuICAgICAgaWYgKHRoaXMuaGFzUmVjZWl2ZWQoXCJ0aW1lb3V0XCIpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuc3RhcnRUaW1lb3V0KCk7XG4gICAgICB0aGlzLnNlbnQgPSB0cnVlO1xuICAgICAgdGhpcy5jaGFubmVsLnNvY2tldC5wdXNoKHtcbiAgICAgICAgdG9waWM6IHRoaXMuY2hhbm5lbC50b3BpYyxcbiAgICAgICAgZXZlbnQ6IHRoaXMuZXZlbnQsXG4gICAgICAgIHBheWxvYWQ6IHRoaXMucGF5bG9hZCxcbiAgICAgICAgcmVmOiB0aGlzLnJlZlxuICAgICAgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcInJlY2VpdmVcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVjZWl2ZShzdGF0dXMsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5oYXNSZWNlaXZlZChzdGF0dXMpKSB7XG4gICAgICAgIGNhbGxiYWNrKHRoaXMucmVjZWl2ZWRSZXNwLnJlc3BvbnNlKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5yZWNIb29rcy5wdXNoKHsgc3RhdHVzOiBzdGF0dXMsIGNhbGxiYWNrOiBjYWxsYmFjayB9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8vIHByaXZhdGVcblxuICB9LCB7XG4gICAga2V5OiBcIm1hdGNoUmVjZWl2ZVwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBtYXRjaFJlY2VpdmUoX3JlZikge1xuICAgICAgdmFyIHN0YXR1cyA9IF9yZWYuc3RhdHVzO1xuICAgICAgdmFyIHJlc3BvbnNlID0gX3JlZi5yZXNwb25zZTtcbiAgICAgIHZhciByZWYgPSBfcmVmLnJlZjtcblxuICAgICAgdGhpcy5yZWNIb29rcy5maWx0ZXIoZnVuY3Rpb24gKGgpIHtcbiAgICAgICAgcmV0dXJuIGguc3RhdHVzID09PSBzdGF0dXM7XG4gICAgICB9KS5mb3JFYWNoKGZ1bmN0aW9uIChoKSB7XG4gICAgICAgIHJldHVybiBoLmNhbGxiYWNrKHJlc3BvbnNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJjYW5jZWxSZWZFdmVudFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjYW5jZWxSZWZFdmVudCgpIHtcbiAgICAgIGlmICghdGhpcy5yZWZFdmVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLmNoYW5uZWwub2ZmKHRoaXMucmVmRXZlbnQpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJjYW5jZWxUaW1lb3V0XCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGNhbmNlbFRpbWVvdXQoKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0VGltZXIpO1xuICAgICAgdGhpcy50aW1lb3V0VGltZXIgPSBudWxsO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJzdGFydFRpbWVvdXRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gc3RhcnRUaW1lb3V0KCkge1xuICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgaWYgKHRoaXMudGltZW91dFRpbWVyKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVmID0gdGhpcy5jaGFubmVsLnNvY2tldC5tYWtlUmVmKCk7XG4gICAgICB0aGlzLnJlZkV2ZW50ID0gdGhpcy5jaGFubmVsLnJlcGx5RXZlbnROYW1lKHRoaXMucmVmKTtcblxuICAgICAgdGhpcy5jaGFubmVsLm9uKHRoaXMucmVmRXZlbnQsIGZ1bmN0aW9uIChwYXlsb2FkKSB7XG4gICAgICAgIF90aGlzLmNhbmNlbFJlZkV2ZW50KCk7XG4gICAgICAgIF90aGlzLmNhbmNlbFRpbWVvdXQoKTtcbiAgICAgICAgX3RoaXMucmVjZWl2ZWRSZXNwID0gcGF5bG9hZDtcbiAgICAgICAgX3RoaXMubWF0Y2hSZWNlaXZlKHBheWxvYWQpO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGltZW91dFRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgIF90aGlzLnRyaWdnZXIoXCJ0aW1lb3V0XCIsIHt9KTtcbiAgICAgIH0sIHRoaXMudGltZW91dCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcImhhc1JlY2VpdmVkXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGhhc1JlY2VpdmVkKHN0YXR1cykge1xuICAgICAgcmV0dXJuIHRoaXMucmVjZWl2ZWRSZXNwICYmIHRoaXMucmVjZWl2ZWRSZXNwLnN0YXR1cyA9PT0gc3RhdHVzO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJ0cmlnZ2VyXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHRyaWdnZXIoc3RhdHVzLCByZXNwb25zZSkge1xuICAgICAgdGhpcy5jaGFubmVsLnRyaWdnZXIodGhpcy5yZWZFdmVudCwgeyBzdGF0dXM6IHN0YXR1cywgcmVzcG9uc2U6IHJlc3BvbnNlIH0pO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBQdXNoO1xufSgpO1xuXG52YXIgQ2hhbm5lbCA9IGV4cG9ydHMuQ2hhbm5lbCA9IGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gQ2hhbm5lbCh0b3BpYywgcGFyYW1zLCBzb2NrZXQpIHtcbiAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBDaGFubmVsKTtcblxuICAgIHRoaXMuc3RhdGUgPSBDSEFOTkVMX1NUQVRFUy5jbG9zZWQ7XG4gICAgdGhpcy50b3BpYyA9IHRvcGljO1xuICAgIHRoaXMucGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgIHRoaXMuYmluZGluZ3MgPSBbXTtcbiAgICB0aGlzLnRpbWVvdXQgPSB0aGlzLnNvY2tldC50aW1lb3V0O1xuICAgIHRoaXMuam9pbmVkT25jZSA9IGZhbHNlO1xuICAgIHRoaXMuam9pblB1c2ggPSBuZXcgUHVzaCh0aGlzLCBDSEFOTkVMX0VWRU5UUy5qb2luLCB0aGlzLnBhcmFtcywgdGhpcy50aW1lb3V0KTtcbiAgICB0aGlzLnB1c2hCdWZmZXIgPSBbXTtcbiAgICB0aGlzLnJlam9pblRpbWVyID0gbmV3IFRpbWVyKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBfdGhpczIucmVqb2luVW50aWxDb25uZWN0ZWQoKTtcbiAgICB9LCB0aGlzLnNvY2tldC5yZWNvbm5lY3RBZnRlck1zKTtcbiAgICB0aGlzLmpvaW5QdXNoLnJlY2VpdmUoXCJva1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICBfdGhpczIuc3RhdGUgPSBDSEFOTkVMX1NUQVRFUy5qb2luZWQ7XG4gICAgICBfdGhpczIucmVqb2luVGltZXIucmVzZXQoKTtcbiAgICAgIF90aGlzMi5wdXNoQnVmZmVyLmZvckVhY2goZnVuY3Rpb24gKHB1c2hFdmVudCkge1xuICAgICAgICByZXR1cm4gcHVzaEV2ZW50LnNlbmQoKTtcbiAgICAgIH0pO1xuICAgICAgX3RoaXMyLnB1c2hCdWZmZXIgPSBbXTtcbiAgICB9KTtcbiAgICB0aGlzLm9uQ2xvc2UoZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXMyLnNvY2tldC5sb2coXCJjaGFubmVsXCIsIFwiY2xvc2UgXCIgKyBfdGhpczIudG9waWMpO1xuICAgICAgX3RoaXMyLnN0YXRlID0gQ0hBTk5FTF9TVEFURVMuY2xvc2VkO1xuICAgICAgX3RoaXMyLnNvY2tldC5yZW1vdmUoX3RoaXMyKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uRXJyb3IoZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgX3RoaXMyLnNvY2tldC5sb2coXCJjaGFubmVsXCIsIFwiZXJyb3IgXCIgKyBfdGhpczIudG9waWMsIHJlYXNvbik7XG4gICAgICBfdGhpczIuc3RhdGUgPSBDSEFOTkVMX1NUQVRFUy5lcnJvcmVkO1xuICAgICAgX3RoaXMyLnJlam9pblRpbWVyLnNjaGVkdWxlVGltZW91dCgpO1xuICAgIH0pO1xuICAgIHRoaXMuam9pblB1c2gucmVjZWl2ZShcInRpbWVvdXRcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKF90aGlzMi5zdGF0ZSAhPT0gQ0hBTk5FTF9TVEFURVMuam9pbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIF90aGlzMi5zb2NrZXQubG9nKFwiY2hhbm5lbFwiLCBcInRpbWVvdXQgXCIgKyBfdGhpczIudG9waWMsIF90aGlzMi5qb2luUHVzaC50aW1lb3V0KTtcbiAgICAgIF90aGlzMi5zdGF0ZSA9IENIQU5ORUxfU1RBVEVTLmVycm9yZWQ7XG4gICAgICBfdGhpczIucmVqb2luVGltZXIuc2NoZWR1bGVUaW1lb3V0KCk7XG4gICAgfSk7XG4gICAgdGhpcy5vbihDSEFOTkVMX0VWRU5UUy5yZXBseSwgZnVuY3Rpb24gKHBheWxvYWQsIHJlZikge1xuICAgICAgX3RoaXMyLnRyaWdnZXIoX3RoaXMyLnJlcGx5RXZlbnROYW1lKHJlZiksIHBheWxvYWQpO1xuICAgIH0pO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKENoYW5uZWwsIFt7XG4gICAga2V5OiBcInJlam9pblVudGlsQ29ubmVjdGVkXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlam9pblVudGlsQ29ubmVjdGVkKCkge1xuICAgICAgdGhpcy5yZWpvaW5UaW1lci5zY2hlZHVsZVRpbWVvdXQoKTtcbiAgICAgIGlmICh0aGlzLnNvY2tldC5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgIHRoaXMucmVqb2luKCk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcImpvaW5cIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gam9pbigpIHtcbiAgICAgIHZhciB0aW1lb3V0ID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gdGhpcy50aW1lb3V0IDogYXJndW1lbnRzWzBdO1xuXG4gICAgICBpZiAodGhpcy5qb2luZWRPbmNlKSB7XG4gICAgICAgIHRocm93IFwidHJpZWQgdG8gam9pbiBtdWx0aXBsZSB0aW1lcy4gJ2pvaW4nIGNhbiBvbmx5IGJlIGNhbGxlZCBhIHNpbmdsZSB0aW1lIHBlciBjaGFubmVsIGluc3RhbmNlXCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmpvaW5lZE9uY2UgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5yZWpvaW4odGltZW91dCk7XG4gICAgICByZXR1cm4gdGhpcy5qb2luUHVzaDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwib25DbG9zZVwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvbkNsb3NlKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLm9uKENIQU5ORUxfRVZFTlRTLmNsb3NlLCBjYWxsYmFjayk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcIm9uRXJyb3JcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gb25FcnJvcihjYWxsYmFjaykge1xuICAgICAgdGhpcy5vbihDSEFOTkVMX0VWRU5UUy5lcnJvciwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2socmVhc29uKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJvblwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICAgIHRoaXMuYmluZGluZ3MucHVzaCh7IGV2ZW50OiBldmVudCwgY2FsbGJhY2s6IGNhbGxiYWNrIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJvZmZcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gb2ZmKGV2ZW50KSB7XG4gICAgICB0aGlzLmJpbmRpbmdzID0gdGhpcy5iaW5kaW5ncy5maWx0ZXIoZnVuY3Rpb24gKGJpbmQpIHtcbiAgICAgICAgcmV0dXJuIGJpbmQuZXZlbnQgIT09IGV2ZW50O1xuICAgICAgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcImNhblB1c2hcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gY2FuUHVzaCgpIHtcbiAgICAgIHJldHVybiB0aGlzLnNvY2tldC5pc0Nvbm5lY3RlZCgpICYmIHRoaXMuc3RhdGUgPT09IENIQU5ORUxfU1RBVEVTLmpvaW5lZDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwicHVzaFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwdXNoKGV2ZW50LCBwYXlsb2FkKSB7XG4gICAgICB2YXIgdGltZW91dCA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IHRoaXMudGltZW91dCA6IGFyZ3VtZW50c1syXTtcblxuICAgICAgaWYgKCF0aGlzLmpvaW5lZE9uY2UpIHtcbiAgICAgICAgdGhyb3cgXCJ0cmllZCB0byBwdXNoICdcIiArIGV2ZW50ICsgXCInIHRvICdcIiArIHRoaXMudG9waWMgKyBcIicgYmVmb3JlIGpvaW5pbmcuIFVzZSBjaGFubmVsLmpvaW4oKSBiZWZvcmUgcHVzaGluZyBldmVudHNcIjtcbiAgICAgIH1cbiAgICAgIHZhciBwdXNoRXZlbnQgPSBuZXcgUHVzaCh0aGlzLCBldmVudCwgcGF5bG9hZCwgdGltZW91dCk7XG4gICAgICBpZiAodGhpcy5jYW5QdXNoKCkpIHtcbiAgICAgICAgcHVzaEV2ZW50LnNlbmQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHB1c2hFdmVudC5zdGFydFRpbWVvdXQoKTtcbiAgICAgICAgdGhpcy5wdXNoQnVmZmVyLnB1c2gocHVzaEV2ZW50KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHB1c2hFdmVudDtcbiAgICB9XG5cbiAgICAvLyBMZWF2ZXMgdGhlIGNoYW5uZWxcbiAgICAvL1xuICAgIC8vIFVuc3Vic2NyaWJlcyBmcm9tIHNlcnZlciBldmVudHMsIGFuZFxuICAgIC8vIGluc3RydWN0cyBjaGFubmVsIHRvIHRlcm1pbmF0ZSBvbiBzZXJ2ZXJcbiAgICAvL1xuICAgIC8vIFRyaWdnZXJzIG9uQ2xvc2UoKSBob29rc1xuICAgIC8vXG4gICAgLy8gVG8gcmVjZWl2ZSBsZWF2ZSBhY2tub3dsZWRnZW1lbnRzLCB1c2UgdGhlIGEgYHJlY2VpdmVgXG4gICAgLy8gaG9vayB0byBiaW5kIHRvIHRoZSBzZXJ2ZXIgYWNrLCBpZTpcbiAgICAvL1xuICAgIC8vICAgICBjaGFubmVsLmxlYXZlKCkucmVjZWl2ZShcIm9rXCIsICgpID0+IGFsZXJ0KFwibGVmdCFcIikgKVxuICAgIC8vXG5cbiAgfSwge1xuICAgIGtleTogXCJsZWF2ZVwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBsZWF2ZSgpIHtcbiAgICAgIHZhciBfdGhpczMgPSB0aGlzO1xuXG4gICAgICB2YXIgdGltZW91dCA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHRoaXMudGltZW91dCA6IGFyZ3VtZW50c1swXTtcblxuICAgICAgdmFyIG9uQ2xvc2UgPSBmdW5jdGlvbiBvbkNsb3NlKCkge1xuICAgICAgICBfdGhpczMuc29ja2V0LmxvZyhcImNoYW5uZWxcIiwgXCJsZWF2ZSBcIiArIF90aGlzMy50b3BpYyk7XG4gICAgICAgIF90aGlzMy50cmlnZ2VyKENIQU5ORUxfRVZFTlRTLmNsb3NlLCBcImxlYXZlXCIpO1xuICAgICAgfTtcbiAgICAgIHZhciBsZWF2ZVB1c2ggPSBuZXcgUHVzaCh0aGlzLCBDSEFOTkVMX0VWRU5UUy5sZWF2ZSwge30sIHRpbWVvdXQpO1xuICAgICAgbGVhdmVQdXNoLnJlY2VpdmUoXCJva1wiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBvbkNsb3NlKCk7XG4gICAgICB9KS5yZWNlaXZlKFwidGltZW91dFwiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBvbkNsb3NlKCk7XG4gICAgICB9KTtcbiAgICAgIGxlYXZlUHVzaC5zZW5kKCk7XG4gICAgICBpZiAoIXRoaXMuY2FuUHVzaCgpKSB7XG4gICAgICAgIGxlYXZlUHVzaC50cmlnZ2VyKFwib2tcIiwge30pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbGVhdmVQdXNoO1xuICAgIH1cblxuICAgIC8vIE92ZXJyaWRhYmxlIG1lc3NhZ2UgaG9va1xuICAgIC8vXG4gICAgLy8gUmVjZWl2ZXMgYWxsIGV2ZW50cyBmb3Igc3BlY2lhbGl6ZWQgbWVzc2FnZSBoYW5kbGluZ1xuXG4gIH0sIHtcbiAgICBrZXk6IFwib25NZXNzYWdlXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG9uTWVzc2FnZShldmVudCwgcGF5bG9hZCwgcmVmKSB7fVxuXG4gICAgLy8gcHJpdmF0ZVxuXG4gIH0sIHtcbiAgICBrZXk6IFwiaXNNZW1iZXJcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gaXNNZW1iZXIodG9waWMpIHtcbiAgICAgIHJldHVybiB0aGlzLnRvcGljID09PSB0b3BpYztcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwic2VuZEpvaW5cIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2VuZEpvaW4odGltZW91dCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IENIQU5ORUxfU1RBVEVTLmpvaW5pbmc7XG4gICAgICB0aGlzLmpvaW5QdXNoLnJlc2VuZCh0aW1lb3V0KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwicmVqb2luXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlam9pbigpIHtcbiAgICAgIHZhciB0aW1lb3V0ID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gdGhpcy50aW1lb3V0IDogYXJndW1lbnRzWzBdO1xuICAgICAgdGhpcy5zZW5kSm9pbih0aW1lb3V0KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwidHJpZ2dlclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB0cmlnZ2VyKHRyaWdnZXJFdmVudCwgcGF5bG9hZCwgcmVmKSB7XG4gICAgICB0aGlzLm9uTWVzc2FnZSh0cmlnZ2VyRXZlbnQsIHBheWxvYWQsIHJlZik7XG4gICAgICB0aGlzLmJpbmRpbmdzLmZpbHRlcihmdW5jdGlvbiAoYmluZCkge1xuICAgICAgICByZXR1cm4gYmluZC5ldmVudCA9PT0gdHJpZ2dlckV2ZW50O1xuICAgICAgfSkubWFwKGZ1bmN0aW9uIChiaW5kKSB7XG4gICAgICAgIHJldHVybiBiaW5kLmNhbGxiYWNrKHBheWxvYWQsIHJlZik7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwicmVwbHlFdmVudE5hbWVcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVwbHlFdmVudE5hbWUocmVmKSB7XG4gICAgICByZXR1cm4gXCJjaGFuX3JlcGx5X1wiICsgcmVmO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBDaGFubmVsO1xufSgpO1xuXG52YXIgU29ja2V0ID0gZXhwb3J0cy5Tb2NrZXQgPSBmdW5jdGlvbiAoKSB7XG5cbiAgLy8gSW5pdGlhbGl6ZXMgdGhlIFNvY2tldFxuICAvL1xuICAvLyBlbmRQb2ludCAtIFRoZSBzdHJpbmcgV2ViU29ja2V0IGVuZHBvaW50LCBpZSwgXCJ3czovL2V4YW1wbGUuY29tL3dzXCIsXG4gIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIndzczovL2V4YW1wbGUuY29tXCJcbiAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiL3dzXCIgKGluaGVyaXRlZCBob3N0ICYgcHJvdG9jb2wpXG4gIC8vIG9wdHMgLSBPcHRpb25hbCBjb25maWd1cmF0aW9uXG4gIC8vICAgdHJhbnNwb3J0IC0gVGhlIFdlYnNvY2tldCBUcmFuc3BvcnQsIGZvciBleGFtcGxlIFdlYlNvY2tldCBvciBQaG9lbml4LkxvbmdQb2xsLlxuICAvLyAgICAgICAgICAgICAgIERlZmF1bHRzIHRvIFdlYlNvY2tldCB3aXRoIGF1dG9tYXRpYyBMb25nUG9sbCBmYWxsYmFjay5cbiAgLy8gICB0aW1lb3V0IC0gVGhlIGRlZmF1bHQgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgdG8gdHJpZ2dlciBwdXNoIHRpbWVvdXRzLlxuICAvLyAgICAgICAgICAgICBEZWZhdWx0cyBgREVGQVVMVF9USU1FT1VUYFxuICAvLyAgIGhlYXJ0YmVhdEludGVydmFsTXMgLSBUaGUgbWlsbGlzZWMgaW50ZXJ2YWwgdG8gc2VuZCBhIGhlYXJ0YmVhdCBtZXNzYWdlXG4gIC8vICAgcmVjb25uZWN0QWZ0ZXJNcyAtIFRoZSBvcHRpb25hbCBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIG1pbGxzZWNcbiAgLy8gICAgICAgICAgICAgICAgICAgICAgcmVjb25uZWN0IGludGVydmFsLiBEZWZhdWx0cyB0byBzdGVwcGVkIGJhY2tvZmYgb2Y6XG4gIC8vXG4gIC8vICAgICBmdW5jdGlvbih0cmllcyl7XG4gIC8vICAgICAgIHJldHVybiBbMTAwMCwgNTAwMCwgMTAwMDBdW3RyaWVzIC0gMV0gfHwgMTAwMDBcbiAgLy8gICAgIH1cbiAgLy9cbiAgLy8gICBsb2dnZXIgLSBUaGUgb3B0aW9uYWwgZnVuY3Rpb24gZm9yIHNwZWNpYWxpemVkIGxvZ2dpbmcsIGllOlxuICAvLyAgICAgYGxvZ2dlcjogKGtpbmQsIG1zZywgZGF0YSkgPT4geyBjb25zb2xlLmxvZyhgJHtraW5kfTogJHttc2d9YCwgZGF0YSkgfVxuICAvL1xuICAvLyAgIGxvbmdwb2xsZXJUaW1lb3V0IC0gVGhlIG1heGltdW0gdGltZW91dCBvZiBhIGxvbmcgcG9sbCBBSkFYIHJlcXVlc3QuXG4gIC8vICAgICAgICAgICAgICAgICAgICAgICAgRGVmYXVsdHMgdG8gMjBzIChkb3VibGUgdGhlIHNlcnZlciBsb25nIHBvbGwgdGltZXIpLlxuICAvL1xuICAvLyAgIHBhcmFtcyAtIFRoZSBvcHRpb25hbCBwYXJhbXMgdG8gcGFzcyB3aGVuIGNvbm5lY3RpbmdcbiAgLy9cbiAgLy8gRm9yIElFOCBzdXBwb3J0IHVzZSBhbiBFUzUtc2hpbSAoaHR0cHM6Ly9naXRodWIuY29tL2VzLXNoaW1zL2VzNS1zaGltKVxuICAvL1xuXG4gIGZ1bmN0aW9uIFNvY2tldChlbmRQb2ludCkge1xuICAgIHZhciBfdGhpczQgPSB0aGlzO1xuXG4gICAgdmFyIG9wdHMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDEgfHwgYXJndW1lbnRzWzFdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1sxXTtcblxuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBTb2NrZXQpO1xuXG4gICAgdGhpcy5zdGF0ZUNoYW5nZUNhbGxiYWNrcyA9IHsgb3BlbjogW10sIGNsb3NlOiBbXSwgZXJyb3I6IFtdLCBtZXNzYWdlOiBbXSB9O1xuICAgIHRoaXMuY2hhbm5lbHMgPSBbXTtcbiAgICB0aGlzLnNlbmRCdWZmZXIgPSBbXTtcbiAgICB0aGlzLnJlZiA9IDA7XG4gICAgdGhpcy50aW1lb3V0ID0gb3B0cy50aW1lb3V0IHx8IERFRkFVTFRfVElNRU9VVDtcbiAgICB0aGlzLnRyYW5zcG9ydCA9IG9wdHMudHJhbnNwb3J0IHx8IHdpbmRvdy5XZWJTb2NrZXQgfHwgTG9uZ1BvbGw7XG4gICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbE1zID0gb3B0cy5oZWFydGJlYXRJbnRlcnZhbE1zIHx8IDMwMDAwO1xuICAgIHRoaXMucmVjb25uZWN0QWZ0ZXJNcyA9IG9wdHMucmVjb25uZWN0QWZ0ZXJNcyB8fCBmdW5jdGlvbiAodHJpZXMpIHtcbiAgICAgIHJldHVybiBbMTAwMCwgMjAwMCwgNTAwMCwgMTAwMDBdW3RyaWVzIC0gMV0gfHwgMTAwMDA7XG4gICAgfTtcbiAgICB0aGlzLmxvZ2dlciA9IG9wdHMubG9nZ2VyIHx8IGZ1bmN0aW9uICgpIHt9OyAvLyBub29wXG4gICAgdGhpcy5sb25ncG9sbGVyVGltZW91dCA9IG9wdHMubG9uZ3BvbGxlclRpbWVvdXQgfHwgMjAwMDA7XG4gICAgdGhpcy5wYXJhbXMgPSBvcHRzLnBhcmFtcyB8fCB7fTtcbiAgICB0aGlzLmVuZFBvaW50ID0gZW5kUG9pbnQgKyBcIi9cIiArIFRSQU5TUE9SVFMud2Vic29ja2V0O1xuICAgIHRoaXMucmVjb25uZWN0VGltZXIgPSBuZXcgVGltZXIoZnVuY3Rpb24gKCkge1xuICAgICAgX3RoaXM0LmRpc2Nvbm5lY3QoZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gX3RoaXM0LmNvbm5lY3QoKTtcbiAgICAgIH0pO1xuICAgIH0sIHRoaXMucmVjb25uZWN0QWZ0ZXJNcyk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoU29ja2V0LCBbe1xuICAgIGtleTogXCJwcm90b2NvbFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwcm90b2NvbCgpIHtcbiAgICAgIHJldHVybiBsb2NhdGlvbi5wcm90b2NvbC5tYXRjaCgvXmh0dHBzLykgPyBcIndzc1wiIDogXCJ3c1wiO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJlbmRQb2ludFVSTFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBlbmRQb2ludFVSTCgpIHtcbiAgICAgIHZhciB1cmkgPSBBamF4LmFwcGVuZFBhcmFtcyhBamF4LmFwcGVuZFBhcmFtcyh0aGlzLmVuZFBvaW50LCB0aGlzLnBhcmFtcyksIHsgdnNuOiBWU04gfSk7XG4gICAgICBpZiAodXJpLmNoYXJBdCgwKSAhPT0gXCIvXCIpIHtcbiAgICAgICAgcmV0dXJuIHVyaTtcbiAgICAgIH1cbiAgICAgIGlmICh1cmkuY2hhckF0KDEpID09PSBcIi9cIikge1xuICAgICAgICByZXR1cm4gdGhpcy5wcm90b2NvbCgpICsgXCI6XCIgKyB1cmk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLnByb3RvY29sKCkgKyBcIjovL1wiICsgbG9jYXRpb24uaG9zdCArIHVyaTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiZGlzY29ubmVjdFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBkaXNjb25uZWN0KGNhbGxiYWNrLCBjb2RlLCByZWFzb24pIHtcbiAgICAgIGlmICh0aGlzLmNvbm4pIHtcbiAgICAgICAgdGhpcy5jb25uLm9uY2xvc2UgPSBmdW5jdGlvbiAoKSB7fTsgLy8gbm9vcFxuICAgICAgICBpZiAoY29kZSkge1xuICAgICAgICAgIHRoaXMuY29ubi5jbG9zZShjb2RlLCByZWFzb24gfHwgXCJcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5jb25uLmNsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jb25uID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgLy8gcGFyYW1zIC0gVGhlIHBhcmFtcyB0byBzZW5kIHdoZW4gY29ubmVjdGluZywgZm9yIGV4YW1wbGUgYHt1c2VyX2lkOiB1c2VyVG9rZW59YFxuXG4gIH0sIHtcbiAgICBrZXk6IFwiY29ubmVjdFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjb25uZWN0KHBhcmFtcykge1xuICAgICAgdmFyIF90aGlzNSA9IHRoaXM7XG5cbiAgICAgIGlmIChwYXJhbXMpIHtcbiAgICAgICAgY29uc29sZSAmJiBjb25zb2xlLmxvZyhcInBhc3NpbmcgcGFyYW1zIHRvIGNvbm5lY3QgaXMgZGVwcmVjYXRlZC4gSW5zdGVhZCBwYXNzIDpwYXJhbXMgdG8gdGhlIFNvY2tldCBjb25zdHJ1Y3RvclwiKTtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSBwYXJhbXM7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5jb25uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jb25uID0gbmV3IHRoaXMudHJhbnNwb3J0KHRoaXMuZW5kUG9pbnRVUkwoKSk7XG4gICAgICB0aGlzLmNvbm4udGltZW91dCA9IHRoaXMubG9uZ3BvbGxlclRpbWVvdXQ7XG4gICAgICB0aGlzLmNvbm4ub25vcGVuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gX3RoaXM1Lm9uQ29ubk9wZW4oKTtcbiAgICAgIH07XG4gICAgICB0aGlzLmNvbm4ub25lcnJvciA9IGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICByZXR1cm4gX3RoaXM1Lm9uQ29ubkVycm9yKGVycm9yKTtcbiAgICAgIH07XG4gICAgICB0aGlzLmNvbm4ub25tZXNzYWdlID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHJldHVybiBfdGhpczUub25Db25uTWVzc2FnZShldmVudCk7XG4gICAgICB9O1xuICAgICAgdGhpcy5jb25uLm9uY2xvc2UgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgcmV0dXJuIF90aGlzNS5vbkNvbm5DbG9zZShldmVudCk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIExvZ3MgdGhlIG1lc3NhZ2UuIE92ZXJyaWRlIGB0aGlzLmxvZ2dlcmAgZm9yIHNwZWNpYWxpemVkIGxvZ2dpbmcuIG5vb3BzIGJ5IGRlZmF1bHRcblxuICB9LCB7XG4gICAga2V5OiBcImxvZ1wiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBsb2coa2luZCwgbXNnLCBkYXRhKSB7XG4gICAgICB0aGlzLmxvZ2dlcihraW5kLCBtc2csIGRhdGEpO1xuICAgIH1cblxuICAgIC8vIFJlZ2lzdGVycyBjYWxsYmFja3MgZm9yIGNvbm5lY3Rpb24gc3RhdGUgY2hhbmdlIGV2ZW50c1xuICAgIC8vXG4gICAgLy8gRXhhbXBsZXNcbiAgICAvL1xuICAgIC8vICAgIHNvY2tldC5vbkVycm9yKGZ1bmN0aW9uKGVycm9yKXsgYWxlcnQoXCJBbiBlcnJvciBvY2N1cnJlZFwiKSB9KVxuICAgIC8vXG5cbiAgfSwge1xuICAgIGtleTogXCJvbk9wZW5cIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gb25PcGVuKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLnN0YXRlQ2hhbmdlQ2FsbGJhY2tzLm9wZW4ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcIm9uQ2xvc2VcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gb25DbG9zZShjYWxsYmFjaykge1xuICAgICAgdGhpcy5zdGF0ZUNoYW5nZUNhbGxiYWNrcy5jbG9zZS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwib25FcnJvclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvbkVycm9yKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLnN0YXRlQ2hhbmdlQ2FsbGJhY2tzLmVycm9yLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJvbk1lc3NhZ2VcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gb25NZXNzYWdlKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLnN0YXRlQ2hhbmdlQ2FsbGJhY2tzLm1lc3NhZ2UucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcIm9uQ29ubk9wZW5cIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gb25Db25uT3BlbigpIHtcbiAgICAgIHZhciBfdGhpczYgPSB0aGlzO1xuXG4gICAgICB0aGlzLmxvZyhcInRyYW5zcG9ydFwiLCBcImNvbm5lY3RlZCB0byBcIiArIHRoaXMuZW5kUG9pbnRVUkwoKSwgdGhpcy50cmFuc3BvcnQucHJvdG90eXBlKTtcbiAgICAgIHRoaXMuZmx1c2hTZW5kQnVmZmVyKCk7XG4gICAgICB0aGlzLnJlY29ubmVjdFRpbWVyLnJlc2V0KCk7XG4gICAgICBpZiAoIXRoaXMuY29ubi5za2lwSGVhcnRiZWF0KSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oZWFydGJlYXRUaW1lcik7XG4gICAgICAgIHRoaXMuaGVhcnRiZWF0VGltZXIgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzNi5zZW5kSGVhcnRiZWF0KCk7XG4gICAgICAgIH0sIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWxNcyk7XG4gICAgICB9XG4gICAgICB0aGlzLnN0YXRlQ2hhbmdlQ2FsbGJhY2tzLm9wZW4uZm9yRWFjaChmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwib25Db25uQ2xvc2VcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gb25Db25uQ2xvc2UoZXZlbnQpIHtcbiAgICAgIHRoaXMubG9nKFwidHJhbnNwb3J0XCIsIFwiY2xvc2VcIiwgZXZlbnQpO1xuICAgICAgdGhpcy50cmlnZ2VyQ2hhbkVycm9yKCk7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuaGVhcnRiZWF0VGltZXIpO1xuICAgICAgdGhpcy5yZWNvbm5lY3RUaW1lci5zY2hlZHVsZVRpbWVvdXQoKTtcbiAgICAgIHRoaXMuc3RhdGVDaGFuZ2VDYWxsYmFja3MuY2xvc2UuZm9yRWFjaChmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGV2ZW50KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJvbkNvbm5FcnJvclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvbkNvbm5FcnJvcihlcnJvcikge1xuICAgICAgdGhpcy5sb2coXCJ0cmFuc3BvcnRcIiwgZXJyb3IpO1xuICAgICAgdGhpcy50cmlnZ2VyQ2hhbkVycm9yKCk7XG4gICAgICB0aGlzLnN0YXRlQ2hhbmdlQ2FsbGJhY2tzLmVycm9yLmZvckVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvcik7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwidHJpZ2dlckNoYW5FcnJvclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB0cmlnZ2VyQ2hhbkVycm9yKCkge1xuICAgICAgdGhpcy5jaGFubmVscy5mb3JFYWNoKGZ1bmN0aW9uIChjaGFubmVsKSB7XG4gICAgICAgIHJldHVybiBjaGFubmVsLnRyaWdnZXIoQ0hBTk5FTF9FVkVOVFMuZXJyb3IpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcImNvbm5lY3Rpb25TdGF0ZVwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjb25uZWN0aW9uU3RhdGUoKSB7XG4gICAgICBzd2l0Y2ggKHRoaXMuY29ubiAmJiB0aGlzLmNvbm4ucmVhZHlTdGF0ZSkge1xuICAgICAgICBjYXNlIFNPQ0tFVF9TVEFURVMuY29ubmVjdGluZzpcbiAgICAgICAgICByZXR1cm4gXCJjb25uZWN0aW5nXCI7XG4gICAgICAgIGNhc2UgU09DS0VUX1NUQVRFUy5vcGVuOlxuICAgICAgICAgIHJldHVybiBcIm9wZW5cIjtcbiAgICAgICAgY2FzZSBTT0NLRVRfU1RBVEVTLmNsb3Npbmc6XG4gICAgICAgICAgcmV0dXJuIFwiY2xvc2luZ1wiO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBcImNsb3NlZFwiO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJpc0Nvbm5lY3RlZFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBpc0Nvbm5lY3RlZCgpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb25TdGF0ZSgpID09PSBcIm9wZW5cIjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwicmVtb3ZlXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlbW92ZShjaGFubmVsKSB7XG4gICAgICB0aGlzLmNoYW5uZWxzID0gdGhpcy5jaGFubmVscy5maWx0ZXIoZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgcmV0dXJuICFjLmlzTWVtYmVyKGNoYW5uZWwudG9waWMpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcImNoYW5uZWxcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gY2hhbm5lbCh0b3BpYykge1xuICAgICAgdmFyIGNoYW5QYXJhbXMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDEgfHwgYXJndW1lbnRzWzFdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1sxXTtcblxuICAgICAgdmFyIGNoYW4gPSBuZXcgQ2hhbm5lbCh0b3BpYywgY2hhblBhcmFtcywgdGhpcyk7XG4gICAgICB0aGlzLmNoYW5uZWxzLnB1c2goY2hhbik7XG4gICAgICByZXR1cm4gY2hhbjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwicHVzaFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwdXNoKGRhdGEpIHtcbiAgICAgIHZhciBfdGhpczcgPSB0aGlzO1xuXG4gICAgICB2YXIgdG9waWMgPSBkYXRhLnRvcGljO1xuICAgICAgdmFyIGV2ZW50ID0gZGF0YS5ldmVudDtcbiAgICAgIHZhciBwYXlsb2FkID0gZGF0YS5wYXlsb2FkO1xuICAgICAgdmFyIHJlZiA9IGRhdGEucmVmO1xuXG4gICAgICB2YXIgY2FsbGJhY2sgPSBmdW5jdGlvbiBjYWxsYmFjaygpIHtcbiAgICAgICAgcmV0dXJuIF90aGlzNy5jb25uLnNlbmQoSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICAgICAgfTtcbiAgICAgIHRoaXMubG9nKFwicHVzaFwiLCB0b3BpYyArIFwiIFwiICsgZXZlbnQgKyBcIiAoXCIgKyByZWYgKyBcIilcIiwgcGF5bG9hZCk7XG4gICAgICBpZiAodGhpcy5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNlbmRCdWZmZXIucHVzaChjYWxsYmFjayk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBuZXh0IG1lc3NhZ2UgcmVmLCBhY2NvdW50aW5nIGZvciBvdmVyZmxvd3NcblxuICB9LCB7XG4gICAga2V5OiBcIm1ha2VSZWZcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gbWFrZVJlZigpIHtcbiAgICAgIHZhciBuZXdSZWYgPSB0aGlzLnJlZiArIDE7XG4gICAgICBpZiAobmV3UmVmID09PSB0aGlzLnJlZikge1xuICAgICAgICB0aGlzLnJlZiA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlZiA9IG5ld1JlZjtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMucmVmLnRvU3RyaW5nKCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcInNlbmRIZWFydGJlYXRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2VuZEhlYXJ0YmVhdCgpIHtcbiAgICAgIGlmICghdGhpcy5pc0Nvbm5lY3RlZCgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMucHVzaCh7IHRvcGljOiBcInBob2VuaXhcIiwgZXZlbnQ6IFwiaGVhcnRiZWF0XCIsIHBheWxvYWQ6IHt9LCByZWY6IHRoaXMubWFrZVJlZigpIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJmbHVzaFNlbmRCdWZmZXJcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gZmx1c2hTZW5kQnVmZmVyKCkge1xuICAgICAgaWYgKHRoaXMuaXNDb25uZWN0ZWQoKSAmJiB0aGlzLnNlbmRCdWZmZXIubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLnNlbmRCdWZmZXIuZm9yRWFjaChmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuc2VuZEJ1ZmZlciA9IFtdO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJvbkNvbm5NZXNzYWdlXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG9uQ29ubk1lc3NhZ2UocmF3TWVzc2FnZSkge1xuICAgICAgdmFyIG1zZyA9IEpTT04ucGFyc2UocmF3TWVzc2FnZS5kYXRhKTtcbiAgICAgIHZhciB0b3BpYyA9IG1zZy50b3BpYztcbiAgICAgIHZhciBldmVudCA9IG1zZy5ldmVudDtcbiAgICAgIHZhciBwYXlsb2FkID0gbXNnLnBheWxvYWQ7XG4gICAgICB2YXIgcmVmID0gbXNnLnJlZjtcblxuICAgICAgdGhpcy5sb2coXCJyZWNlaXZlXCIsIChwYXlsb2FkLnN0YXR1cyB8fCBcIlwiKSArIFwiIFwiICsgdG9waWMgKyBcIiBcIiArIGV2ZW50ICsgXCIgXCIgKyAocmVmICYmIFwiKFwiICsgcmVmICsgXCIpXCIgfHwgXCJcIiksIHBheWxvYWQpO1xuICAgICAgdGhpcy5jaGFubmVscy5maWx0ZXIoZnVuY3Rpb24gKGNoYW5uZWwpIHtcbiAgICAgICAgcmV0dXJuIGNoYW5uZWwuaXNNZW1iZXIodG9waWMpO1xuICAgICAgfSkuZm9yRWFjaChmdW5jdGlvbiAoY2hhbm5lbCkge1xuICAgICAgICByZXR1cm4gY2hhbm5lbC50cmlnZ2VyKGV2ZW50LCBwYXlsb2FkLCByZWYpO1xuICAgICAgfSk7XG4gICAgICB0aGlzLnN0YXRlQ2hhbmdlQ2FsbGJhY2tzLm1lc3NhZ2UuZm9yRWFjaChmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG1zZyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gU29ja2V0O1xufSgpO1xuXG52YXIgTG9uZ1BvbGwgPSBleHBvcnRzLkxvbmdQb2xsID0gZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBMb25nUG9sbChlbmRQb2ludCkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBMb25nUG9sbCk7XG5cbiAgICB0aGlzLmVuZFBvaW50ID0gbnVsbDtcbiAgICB0aGlzLnRva2VuID0gbnVsbDtcbiAgICB0aGlzLnNraXBIZWFydGJlYXQgPSB0cnVlO1xuICAgIHRoaXMub25vcGVuID0gZnVuY3Rpb24gKCkge307IC8vIG5vb3BcbiAgICB0aGlzLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7fTsgLy8gbm9vcFxuICAgIHRoaXMub25tZXNzYWdlID0gZnVuY3Rpb24gKCkge307IC8vIG5vb3BcbiAgICB0aGlzLm9uY2xvc2UgPSBmdW5jdGlvbiAoKSB7fTsgLy8gbm9vcFxuICAgIHRoaXMucG9sbEVuZHBvaW50ID0gdGhpcy5ub3JtYWxpemVFbmRwb2ludChlbmRQb2ludCk7XG4gICAgdGhpcy5yZWFkeVN0YXRlID0gU09DS0VUX1NUQVRFUy5jb25uZWN0aW5nO1xuXG4gICAgdGhpcy5wb2xsKCk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoTG9uZ1BvbGwsIFt7XG4gICAga2V5OiBcIm5vcm1hbGl6ZUVuZHBvaW50XCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG5vcm1hbGl6ZUVuZHBvaW50KGVuZFBvaW50KSB7XG4gICAgICByZXR1cm4gZW5kUG9pbnQucmVwbGFjZShcIndzOi8vXCIsIFwiaHR0cDovL1wiKS5yZXBsYWNlKFwid3NzOi8vXCIsIFwiaHR0cHM6Ly9cIikucmVwbGFjZShuZXcgUmVnRXhwKFwiKC4qKVxcL1wiICsgVFJBTlNQT1JUUy53ZWJzb2NrZXQpLCBcIiQxL1wiICsgVFJBTlNQT1JUUy5sb25ncG9sbCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcImVuZHBvaW50VVJMXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGVuZHBvaW50VVJMKCkge1xuICAgICAgcmV0dXJuIEFqYXguYXBwZW5kUGFyYW1zKHRoaXMucG9sbEVuZHBvaW50LCB7IHRva2VuOiB0aGlzLnRva2VuIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJjbG9zZUFuZFJldHJ5XCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGNsb3NlQW5kUmV0cnkoKSB7XG4gICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB0aGlzLnJlYWR5U3RhdGUgPSBTT0NLRVRfU1RBVEVTLmNvbm5lY3Rpbmc7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcIm9udGltZW91dFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvbnRpbWVvdXQoKSB7XG4gICAgICB0aGlzLm9uZXJyb3IoXCJ0aW1lb3V0XCIpO1xuICAgICAgdGhpcy5jbG9zZUFuZFJldHJ5KCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcInBvbGxcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gcG9sbCgpIHtcbiAgICAgIHZhciBfdGhpczggPSB0aGlzO1xuXG4gICAgICBpZiAoISh0aGlzLnJlYWR5U3RhdGUgPT09IFNPQ0tFVF9TVEFURVMub3BlbiB8fCB0aGlzLnJlYWR5U3RhdGUgPT09IFNPQ0tFVF9TVEFURVMuY29ubmVjdGluZykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBBamF4LnJlcXVlc3QoXCJHRVRcIiwgdGhpcy5lbmRwb2ludFVSTCgpLCBcImFwcGxpY2F0aW9uL2pzb25cIiwgbnVsbCwgdGhpcy50aW1lb3V0LCB0aGlzLm9udGltZW91dC5iaW5kKHRoaXMpLCBmdW5jdGlvbiAocmVzcCkge1xuICAgICAgICBpZiAocmVzcCkge1xuICAgICAgICAgIHZhciBzdGF0dXMgPSByZXNwLnN0YXR1cztcbiAgICAgICAgICB2YXIgdG9rZW4gPSByZXNwLnRva2VuO1xuICAgICAgICAgIHZhciBtZXNzYWdlcyA9IHJlc3AubWVzc2FnZXM7XG5cbiAgICAgICAgICBfdGhpczgudG9rZW4gPSB0b2tlbjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgc3RhdHVzID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaCAoc3RhdHVzKSB7XG4gICAgICAgICAgY2FzZSAyMDA6XG4gICAgICAgICAgICBtZXNzYWdlcy5mb3JFYWNoKGZ1bmN0aW9uIChtc2cpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIF90aGlzOC5vbm1lc3NhZ2UoeyBkYXRhOiBKU09OLnN0cmluZ2lmeShtc2cpIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBfdGhpczgucG9sbCgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyMDQ6XG4gICAgICAgICAgICBfdGhpczgucG9sbCgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSA0MTA6XG4gICAgICAgICAgICBfdGhpczgucmVhZHlTdGF0ZSA9IFNPQ0tFVF9TVEFURVMub3BlbjtcbiAgICAgICAgICAgIF90aGlzOC5vbm9wZW4oKTtcbiAgICAgICAgICAgIF90aGlzOC5wb2xsKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgY2FzZSA1MDA6XG4gICAgICAgICAgICBfdGhpczgub25lcnJvcigpO1xuICAgICAgICAgICAgX3RoaXM4LmNsb3NlQW5kUmV0cnkoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyBcInVuaGFuZGxlZCBwb2xsIHN0YXR1cyBcIiArIHN0YXR1cztcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcInNlbmRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2VuZChib2R5KSB7XG4gICAgICB2YXIgX3RoaXM5ID0gdGhpcztcblxuICAgICAgQWpheC5yZXF1ZXN0KFwiUE9TVFwiLCB0aGlzLmVuZHBvaW50VVJMKCksIFwiYXBwbGljYXRpb24vanNvblwiLCBib2R5LCB0aGlzLnRpbWVvdXQsIHRoaXMub25lcnJvci5iaW5kKHRoaXMsIFwidGltZW91dFwiKSwgZnVuY3Rpb24gKHJlc3ApIHtcbiAgICAgICAgaWYgKCFyZXNwIHx8IHJlc3Auc3RhdHVzICE9PSAyMDApIHtcbiAgICAgICAgICBfdGhpczkub25lcnJvcihzdGF0dXMpO1xuICAgICAgICAgIF90aGlzOS5jbG9zZUFuZFJldHJ5KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJjbG9zZVwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjbG9zZShjb2RlLCByZWFzb24pIHtcbiAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IFNPQ0tFVF9TVEFURVMuY2xvc2VkO1xuICAgICAgdGhpcy5vbmNsb3NlKCk7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIExvbmdQb2xsO1xufSgpO1xuXG52YXIgQWpheCA9IGV4cG9ydHMuQWpheCA9IGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gQWpheCgpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgQWpheCk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoQWpheCwgbnVsbCwgW3tcbiAgICBrZXk6IFwicmVxdWVzdFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZXF1ZXN0KG1ldGhvZCwgZW5kUG9pbnQsIGFjY2VwdCwgYm9keSwgdGltZW91dCwgb250aW1lb3V0LCBjYWxsYmFjaykge1xuICAgICAgaWYgKHdpbmRvdy5YRG9tYWluUmVxdWVzdCkge1xuICAgICAgICB2YXIgcmVxID0gbmV3IFhEb21haW5SZXF1ZXN0KCk7IC8vIElFOCwgSUU5XG4gICAgICAgIHRoaXMueGRvbWFpblJlcXVlc3QocmVxLCBtZXRob2QsIGVuZFBvaW50LCBib2R5LCB0aW1lb3V0LCBvbnRpbWVvdXQsIGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByZXEgPSB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgPyBuZXcgWE1MSHR0cFJlcXVlc3QoKSA6IC8vIElFNyssIEZpcmVmb3gsIENocm9tZSwgT3BlcmEsIFNhZmFyaVxuICAgICAgICBuZXcgQWN0aXZlWE9iamVjdChcIk1pY3Jvc29mdC5YTUxIVFRQXCIpOyAvLyBJRTYsIElFNVxuICAgICAgICB0aGlzLnhoclJlcXVlc3QocmVxLCBtZXRob2QsIGVuZFBvaW50LCBhY2NlcHQsIGJvZHksIHRpbWVvdXQsIG9udGltZW91dCwgY2FsbGJhY2spO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJ4ZG9tYWluUmVxdWVzdFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB4ZG9tYWluUmVxdWVzdChyZXEsIG1ldGhvZCwgZW5kUG9pbnQsIGJvZHksIHRpbWVvdXQsIG9udGltZW91dCwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBfdGhpczEwID0gdGhpcztcblxuICAgICAgcmVxLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgICAgcmVxLm9wZW4obWV0aG9kLCBlbmRQb2ludCk7XG4gICAgICByZXEub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzcG9uc2UgPSBfdGhpczEwLnBhcnNlSlNPTihyZXEucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2socmVzcG9uc2UpO1xuICAgICAgfTtcbiAgICAgIGlmIChvbnRpbWVvdXQpIHtcbiAgICAgICAgcmVxLm9udGltZW91dCA9IG9udGltZW91dDtcbiAgICAgIH1cblxuICAgICAgLy8gV29yayBhcm91bmQgYnVnIGluIElFOSB0aGF0IHJlcXVpcmVzIGFuIGF0dGFjaGVkIG9ucHJvZ3Jlc3MgaGFuZGxlclxuICAgICAgcmVxLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7fTtcblxuICAgICAgcmVxLnNlbmQoYm9keSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcInhoclJlcXVlc3RcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24geGhyUmVxdWVzdChyZXEsIG1ldGhvZCwgZW5kUG9pbnQsIGFjY2VwdCwgYm9keSwgdGltZW91dCwgb250aW1lb3V0LCBjYWxsYmFjaykge1xuICAgICAgdmFyIF90aGlzMTEgPSB0aGlzO1xuXG4gICAgICByZXEudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgICByZXEub3BlbihtZXRob2QsIGVuZFBvaW50LCB0cnVlKTtcbiAgICAgIHJlcS5zZXRSZXF1ZXN0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIGFjY2VwdCk7XG4gICAgICByZXEub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2sobnVsbCk7XG4gICAgICB9O1xuICAgICAgcmVxLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHJlcS5yZWFkeVN0YXRlID09PSBfdGhpczExLnN0YXRlcy5jb21wbGV0ZSAmJiBjYWxsYmFjaykge1xuICAgICAgICAgIHZhciByZXNwb25zZSA9IF90aGlzMTEucGFyc2VKU09OKHJlcS5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIGNhbGxiYWNrKHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChvbnRpbWVvdXQpIHtcbiAgICAgICAgcmVxLm9udGltZW91dCA9IG9udGltZW91dDtcbiAgICAgIH1cblxuICAgICAgcmVxLnNlbmQoYm9keSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcInBhcnNlSlNPTlwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwYXJzZUpTT04ocmVzcCkge1xuICAgICAgcmV0dXJuIHJlc3AgJiYgcmVzcCAhPT0gXCJcIiA/IEpTT04ucGFyc2UocmVzcCkgOiBudWxsO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJzZXJpYWxpemVcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2VyaWFsaXplKG9iaiwgcGFyZW50S2V5KSB7XG4gICAgICB2YXIgcXVlcnlTdHIgPSBbXTtcbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKCFvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBwYXJhbUtleSA9IHBhcmVudEtleSA/IHBhcmVudEtleSArIFwiW1wiICsga2V5ICsgXCJdXCIgOiBrZXk7XG4gICAgICAgIHZhciBwYXJhbVZhbCA9IG9ialtrZXldO1xuICAgICAgICBpZiAoKHR5cGVvZiBwYXJhbVZhbCA9PT0gXCJ1bmRlZmluZWRcIiA/IFwidW5kZWZpbmVkXCIgOiBfdHlwZW9mKHBhcmFtVmFsKSkgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICBxdWVyeVN0ci5wdXNoKHRoaXMuc2VyaWFsaXplKHBhcmFtVmFsLCBwYXJhbUtleSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHF1ZXJ5U3RyLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KHBhcmFtS2V5KSArIFwiPVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KHBhcmFtVmFsKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBxdWVyeVN0ci5qb2luKFwiJlwiKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiYXBwZW5kUGFyYW1zXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGFwcGVuZFBhcmFtcyh1cmwsIHBhcmFtcykge1xuICAgICAgaWYgKE9iamVjdC5rZXlzKHBhcmFtcykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiB1cmw7XG4gICAgICB9XG5cbiAgICAgIHZhciBwcmVmaXggPSB1cmwubWF0Y2goL1xcPy8pID8gXCImXCIgOiBcIj9cIjtcbiAgICAgIHJldHVybiBcIlwiICsgdXJsICsgcHJlZml4ICsgdGhpcy5zZXJpYWxpemUocGFyYW1zKTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gQWpheDtcbn0oKTtcblxuQWpheC5zdGF0ZXMgPSB7IGNvbXBsZXRlOiA0IH07XG5cbi8vIENyZWF0ZXMgYSB0aW1lciB0aGF0IGFjY2VwdHMgYSBgdGltZXJDYWxjYCBmdW5jdGlvbiB0byBwZXJmb3JtXG4vLyBjYWxjdWxhdGVkIHRpbWVvdXQgcmV0cmllcywgc3VjaCBhcyBleHBvbmVudGlhbCBiYWNrb2ZmLlxuLy9cbi8vICMjIEV4YW1wbGVzXG4vL1xuLy8gICAgbGV0IHJlY29ubmVjdFRpbWVyID0gbmV3IFRpbWVyKCgpID0+IHRoaXMuY29ubmVjdCgpLCBmdW5jdGlvbih0cmllcyl7XG4vLyAgICAgIHJldHVybiBbMTAwMCwgNTAwMCwgMTAwMDBdW3RyaWVzIC0gMV0gfHwgMTAwMDBcbi8vICAgIH0pXG4vLyAgICByZWNvbm5lY3RUaW1lci5zY2hlZHVsZVRpbWVvdXQoKSAvLyBmaXJlcyBhZnRlciAxMDAwXG4vLyAgICByZWNvbm5lY3RUaW1lci5zY2hlZHVsZVRpbWVvdXQoKSAvLyBmaXJlcyBhZnRlciA1MDAwXG4vLyAgICByZWNvbm5lY3RUaW1lci5yZXNldCgpXG4vLyAgICByZWNvbm5lY3RUaW1lci5zY2hlZHVsZVRpbWVvdXQoKSAvLyBmaXJlcyBhZnRlciAxMDAwXG4vL1xuXG52YXIgVGltZXIgPSBmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIFRpbWVyKGNhbGxiYWNrLCB0aW1lckNhbGMpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgVGltZXIpO1xuXG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIHRoaXMudGltZXJDYWxjID0gdGltZXJDYWxjO1xuICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIHRoaXMudHJpZXMgPSAwO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFRpbWVyLCBbe1xuICAgIGtleTogXCJyZXNldFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZXNldCgpIHtcbiAgICAgIHRoaXMudHJpZXMgPSAwO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZXIpO1xuICAgIH1cblxuICAgIC8vIENhbmNlbHMgYW55IHByZXZpb3VzIHNjaGVkdWxlVGltZW91dCBhbmQgc2NoZWR1bGVzIGNhbGxiYWNrXG5cbiAgfSwge1xuICAgIGtleTogXCJzY2hlZHVsZVRpbWVvdXRcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2NoZWR1bGVUaW1lb3V0KCkge1xuICAgICAgdmFyIF90aGlzMTIgPSB0aGlzO1xuXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lcik7XG5cbiAgICAgIHRoaXMudGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3RoaXMxMi50cmllcyA9IF90aGlzMTIudHJpZXMgKyAxO1xuICAgICAgICBfdGhpczEyLmNhbGxiYWNrKCk7XG4gICAgICB9LCB0aGlzLnRpbWVyQ2FsYyh0aGlzLnRyaWVzICsgMSkpO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBUaW1lcjtcbn0oKTtcblxuXG59KSh0eXBlb2YoZXhwb3J0cykgPT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cuUGhvZW5peCA9IHdpbmRvdy5QaG9lbml4IHx8IHt9IDogZXhwb3J0cyk7XG4iLCJpbXBvcnQgXCIuLi8uLi8uLi9kZXBzL3Bob2VuaXhfaHRtbC93ZWIvc3RhdGljL2pzL3Bob2VuaXhfaHRtbFwiO1xuaW1wb3J0IFNvY2tldCBmcm9tIFwiLi9zb2NrZXRcIjtcblxuXG4iLCIvLyBOT1RFOiBUaGUgY29udGVudHMgb2YgdGhpcyBmaWxlIHdpbGwgb25seSBiZSBleGVjdXRlZCBpZlxuLy8geW91IHVuY29tbWVudCBpdHMgZW50cnkgaW4gXCJ3ZWIvc3RhdGljL2pzL2FwcC5qc1wiLlxuXG4vLyBUbyB1c2UgUGhvZW5peCBjaGFubmVscywgdGhlIGZpcnN0IHN0ZXAgaXMgdG8gaW1wb3J0IFNvY2tldFxuLy8gYW5kIGNvbm5lY3QgYXQgdGhlIHNvY2tldCBwYXRoIGluIFwibGliL215X2FwcC9lbmRwb2ludC5leFwiOlxuaW1wb3J0IHtTb2NrZXR9IGZyb20gXCJwaG9lbml4XCJcblxubGV0IHNvY2tldCA9IG5ldyBTb2NrZXQoXCIvc29ja2V0XCIsIHtwYXJhbXM6IHt0b2tlbjogd2luZG93LnVzZXJUb2tlbn19KVxuXG4vLyBXaGVuIHlvdSBjb25uZWN0LCB5b3UnbGwgb2Z0ZW4gbmVlZCB0byBhdXRoZW50aWNhdGUgdGhlIGNsaWVudC5cbi8vIEZvciBleGFtcGxlLCBpbWFnaW5lIHlvdSBoYXZlIGFuIGF1dGhlbnRpY2F0aW9uIHBsdWcsIGBNeUF1dGhgLFxuLy8gd2hpY2ggYXV0aGVudGljYXRlcyB0aGUgc2Vzc2lvbiBhbmQgYXNzaWducyBhIGA6Y3VycmVudF91c2VyYC5cbi8vIElmIHRoZSBjdXJyZW50IHVzZXIgZXhpc3RzIHlvdSBjYW4gYXNzaWduIHRoZSB1c2VyJ3MgdG9rZW4gaW5cbi8vIHRoZSBjb25uZWN0aW9uIGZvciB1c2UgaW4gdGhlIGxheW91dC5cbi8vXG4vLyBJbiB5b3VyIFwid2ViL3JvdXRlci5leFwiOlxuLy9cbi8vICAgICBwaXBlbGluZSA6YnJvd3NlciBkb1xuLy8gICAgICAgLi4uXG4vLyAgICAgICBwbHVnIE15QXV0aFxuLy8gICAgICAgcGx1ZyA6cHV0X3VzZXJfdG9rZW5cbi8vICAgICBlbmRcbi8vXG4vLyAgICAgZGVmcCBwdXRfdXNlcl90b2tlbihjb25uLCBfKSBkb1xuLy8gICAgICAgaWYgY3VycmVudF91c2VyID0gY29ubi5hc3NpZ25zWzpjdXJyZW50X3VzZXJdIGRvXG4vLyAgICAgICAgIHRva2VuID0gUGhvZW5peC5Ub2tlbi5zaWduKGNvbm4sIFwidXNlciBzb2NrZXRcIiwgY3VycmVudF91c2VyLmlkKVxuLy8gICAgICAgICBhc3NpZ24oY29ubiwgOnVzZXJfdG9rZW4sIHRva2VuKVxuLy8gICAgICAgZWxzZVxuLy8gICAgICAgICBjb25uXG4vLyAgICAgICBlbmRcbi8vICAgICBlbmRcbi8vXG4vLyBOb3cgeW91IG5lZWQgdG8gcGFzcyB0aGlzIHRva2VuIHRvIEphdmFTY3JpcHQuIFlvdSBjYW4gZG8gc29cbi8vIGluc2lkZSBhIHNjcmlwdCB0YWcgaW4gXCJ3ZWIvdGVtcGxhdGVzL2xheW91dC9hcHAuaHRtbC5lZXhcIjpcbi8vXG4vLyAgICAgPHNjcmlwdD53aW5kb3cudXNlclRva2VuID0gXCI8JT0gYXNzaWduc1s6dXNlcl90b2tlbl0gJT5cIjs8L3NjcmlwdD5cbi8vXG4vLyBZb3Ugd2lsbCBuZWVkIHRvIHZlcmlmeSB0aGUgdXNlciB0b2tlbiBpbiB0aGUgXCJjb25uZWN0LzJcIiBmdW5jdGlvblxuLy8gaW4gXCJ3ZWIvY2hhbm5lbHMvdXNlcl9zb2NrZXQuZXhcIjpcbi8vXG4vLyAgICAgZGVmIGNvbm5lY3QoJXtcInRva2VuXCIgPT4gdG9rZW59LCBzb2NrZXQpIGRvXG4vLyAgICAgICAjIG1heF9hZ2U6IDEyMDk2MDAgaXMgZXF1aXZhbGVudCB0byB0d28gd2Vla3MgaW4gc2Vjb25kc1xuLy8gICAgICAgY2FzZSBQaG9lbml4LlRva2VuLnZlcmlmeShzb2NrZXQsIFwidXNlciBzb2NrZXRcIiwgdG9rZW4sIG1heF9hZ2U6IDEyMDk2MDApIGRvXG4vLyAgICAgICAgIHs6b2ssIHVzZXJfaWR9IC0+XG4vLyAgICAgICAgICAgezpvaywgYXNzaWduKHNvY2tldCwgOnVzZXIsIHVzZXJfaWQpfVxuLy8gICAgICAgICB7OmVycm9yLCByZWFzb259IC0+XG4vLyAgICAgICAgICAgOmVycm9yXG4vLyAgICAgICBlbmRcbi8vICAgICBlbmRcbi8vXG4vLyBGaW5hbGx5LCBwYXNzIHRoZSB0b2tlbiBvbiBjb25uZWN0IGFzIGJlbG93LiBPciByZW1vdmUgaXRcbi8vIGZyb20gY29ubmVjdCBpZiB5b3UgZG9uJ3QgY2FyZSBhYm91dCBhdXRoZW50aWNhdGlvbi5cblxuc29ja2V0LmNvbm5lY3QoKVxuXG4vLyBOb3cgdGhhdCB5b3UgYXJlIGNvbm5lY3RlZCwgeW91IGNhbiBqb2luIGNoYW5uZWxzIHdpdGggYSB0b3BpYzpcbmxldCBjaGFubmVsID0gc29ja2V0LmNoYW5uZWwoXCJyb29tczpqb2luXCIsIHt9KVxuY2hhbm5lbC5qb2luKClcbiAgLnJlY2VpdmUoXCJva1wiLCByZXNwID0+IHsgY29uc29sZS5sb2coXCJKb2luZWQgc3VjY2Vzc2Z1bGx5XCIsIHJlc3ApIH0pXG4gIC5yZWNlaXZlKFwiZXJyb3JcIiwgcmVzcCA9PiB7IGNvbnNvbGUubG9nKFwiVW5hYmxlIHRvIGpvaW5cIiwgcmVzcCkgfSlcblxuZXhwb3J0IGRlZmF1bHQgc29ja2V0XG4iXX0=
