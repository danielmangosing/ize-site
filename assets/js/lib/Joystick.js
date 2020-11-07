let upKey = false;
let leftKey = false;
let downKey = false;
let rightKey = false;

class JoyStick {
  constructor(options) {
    const circle = document.createElement("div");
    circle.style.cssText =
      "position:absolute; bottom:35px; width:80px; height:80px; background:rgba(126, 126, 126, 0.5); border:#fff solid medium; border-radius:50%; left:50%; transform:translateX(-50%);";
    const thumb = document.createElement("div");
    thumb.style.cssText =
      "position: absolute; left: 20px; top: 20px; width: 40px; height: 40px; border-radius: 50%; background: #fff;";
    circle.appendChild(thumb);
    document.body.appendChild(circle);
    this.domElement = thumb;
    this.maxRadius = options.maxRadius || 40;
    this.maxRadiusSquared = this.maxRadius * this.maxRadius;
    this.onMove = options.onMove;
    this.game = options.game;
    this.origin = {
      left: this.domElement.offsetLeft,
      top: this.domElement.offsetTop,
    };
    this.mobileMode = "ontouchstart" in window;

    if (this.domElement != undefined) {
      const joystick = this;
      if (this.mobileMode) {
        this.domElement.addEventListener("touchstart", function (evt) {
          joystick.tap(evt);
        });
      } else {
        document.addEventListener("keydown", function (evt) {
          joystick.tap(evt);
        });
        document.addEventListener("keyup", function (evt) {
          joystick.tap(evt);
        });
      }
    }

    if (!this.mobileMode) {
      thumb.style.display = "none";
      circle.style.display = "none";
    }
  }

  getMousePosition(evt) {
    let clientX = evt.targetTouches ? evt.targetTouches[0].pageX : evt.clientX;
    let clientY = evt.targetTouches ? evt.targetTouches[0].pageY : evt.clientY;
    return { x: clientX, y: clientY };
  }

  tap(evt) {
    evt = evt || window.event;
    // get the mouse cursor position at startup:
    this.offset = this.getMousePosition(evt);
    const joystick = this;
    if (this.mobileMode) {
      document.ontouchmove = function (evt) {
        joystick.move(evt);
      };
      document.ontouchend = function (evt) {
        joystick.up(evt);
      };
    } else {
      if (evt.type === "keydown") {
        switch (evt.keyCode) {
          case 87:
            // w
            upKey = true;
            break;
          case 65:
            // a
            leftKey = true;
            break;
          case 83:
            // s
            downKey = true;
            break;
          case 68:
            // d
            rightKey = true;
            break;
        }
        joystick.move(evt);
      } else if (evt.type === "keyup") {
        switch (evt.keyCode) {
          case 87:
            // w
            upKey = false;
            break;
          case 65:
            // a
            leftKey = false;
            break;
          case 83:
            // s
            downKey = false;
            break;
          case 68:
            // d
            rightKey = false;
            break;
        }
        joystick.move(evt);
      }
    }
  }

  move(evt) {
    evt = evt || window.event;
    let forward, turn;

    if (this.mobileMode) {
      const mouse = this.getMousePosition(evt);
      // calculate the new cursor position:
      let left = mouse.x - this.offset.x;
      let top = mouse.y - this.offset.y;
      //this.offset = mouse;

      const sqMag = left * left + top * top;
      if (sqMag > this.maxRadiusSquared) {
        //Only use sqrt if essential
        const magnitude = Math.sqrt(sqMag);
        left /= magnitude;
        top /= magnitude;
        left *= this.maxRadius;
        top *= this.maxRadius;
      }

      // set the element's new position:
      this.domElement.style.top = `${top + this.domElement.clientHeight / 2}px`;
      this.domElement.style.left = `${
        left + this.domElement.clientWidth / 2
      }px`;

      forward =
        -(top - this.origin.top + this.domElement.clientHeight / 2) /
        this.maxRadius;
      turn =
        (left - this.origin.left + this.domElement.clientWidth / 2) /
        this.maxRadius;
    } else {
      if (upKey) {
        forward = 1;
      } else if (downKey) {
        forward = -1;
      }
      if (leftKey) {
        turn = -1;
      } else if (rightKey) {
        turn = 1;
      }
    }
    if (forward == undefined) forward = 0;
    if (turn == undefined) turn = 0;
    if (this.onMove != undefined) this.onMove.call(this.game, forward, turn);
  }

  up(evt) {
    if (this.mobileMode) {
      document.ontouchmove = null;
      document.touchend = null;
      this.domElement.style.top = `${this.origin.top}px`;
      this.domElement.style.left = `${this.origin.left}px`;
    } else {
      document.onkeydown = null;
      document.onkeyup = null;
    }

    this.onMove.call(this.game, 0, 0);
  }
}
