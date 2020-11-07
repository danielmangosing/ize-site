class Game {
  constructor() {
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    this.modes = Object.freeze({
      NONE: Symbol("none"),
      PRELOAD: Symbol("preload"),
      INITIALISING: Symbol("initialising"),
      CREATING_LEVEL: Symbol("creating_level"),
      ACTIVE: Symbol("active"),
      GAMEOVER: Symbol("gameover"),
    });
    this.mode = this.modes.NONE;

    this.container;
    this.player = {};
    this.stats;
    this.controls;
    this.camera;
    this.scene;
    this.renderer;
    this.composer;
    this.cellSize = 16;
    this.interactive = false;
    this.levelIndex = 0;
    this._hints = 0;
    this.score = 0;
    this.debug = false;
    this.debugPhysics = false;
    this.cameraFade = 0.05;
    this.loaded = false;
    this.mute = false;
    this.highlighted;
    this.outlinePass;

    if (localStorage && !this.debug) {
      //const levelIndex = Number(localStorage.getItem('levelIndex'));
      //if (levelIndex!=undefined) this.levelIndex = levelIndex;
    }

    this.container = document.createElement("div");
    this.container.style.height = "100%";
    document.body.appendChild(this.container);

    const game = this;
    this.anims = ["ize_idle_rig"];
    this.tweens = [];

    this.assetsPath = "assets/";

    const options = {
      assets: [
        `${this.assetsPath}fbx/environment6.fbx`,
        `${this.assetsPath}fbx/ize_walk.fbx`,
      ],
      oncomplete: function () {
        game.init();
        game.animate();
      },
    };

    this.anims.forEach(function (anim) {
      options.assets.push(`${game.assetsPath}fbx/${anim}.fbx`);
    });

    this.mode = this.modes.INITIALISING;

    this.clock = new THREE.Clock();

    this.init();
    this.animate();
    // const preloader = new Preloader(options);
  }

  contextAction() {
    console.log("contextAction called " + JSON.stringify(this.onAction));
    if (this.onAction !== undefined) {
      if (this.onAction.action != undefined) {
        this.action = this.onAction.action;
      }
    }
  }

  switchCamera(fade = 0.05) {
    const cams = Object.keys(this.player.cameras);
    cams.splice(cams.indexOf("active"), 1);
    let index;
    for (let prop in this.player.cameras) {
      if (this.player.cameras[prop] == this.player.cameras.active) {
        index = cams.indexOf(prop) + 1;
        if (index >= cams.length) index = 0;
        this.player.cameras.active = this.player.cameras[cams[index]];
        break;
      }
    }
    this.cameraFade = fade;
  }

  set activeCamera(object) {
    this.player.cameras.active = object;
  }



  init() {


    this.mode = this.modes.INITIALISING;

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );

    let hdrLoader = new THREE.CubeTextureLoader()
    .setPath(`assets/cubeMap/`)
    .load( [
		'px.png',
		'nx.png',
		'py.png',
		'ny.png',
		'pz.png',
		'nz.png'
	] );

    let col = 0xFFFFFF;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(col);
    //this.scene.fog = new THREE.Fog(col, 750, 1500);

    let light = new THREE.HemisphereLight(0xff914e, 0x2b5b82,0.5);
    light.position.set(0, 200, 0);
    this.scene.add(light);

    light = new THREE.DirectionalLight(0xffb395,3);
    light.position.set(0, 200, 100);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.top = 3000;
    light.shadow.camera.bottom = -3000;
    light.shadow.camera.left = -3000;
    light.shadow.camera.right = 3000;
    light.shadow.camera.far = 3000;
    this.scene.add(light);

     light = new THREE.AmbientLight(0xff8d5fa, 1);
     this.scene.add(light);

    // ground
    var mesh = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(2000, 2000),
      new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    //mesh.position.y = -100;
    mesh.receiveShadow = true;
    //this.scene.add( mesh );

    var grid = new THREE.GridHelper(2000, 40, 0x000000, 0x000000);
    //grid.position.y = -100;
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    //this.scene.add( grid );

    // model + load manager
    const manager = new THREE.LoadingManager();
    manager.onStart = (url, itemsLoaded, itemsTotal) => {
      // console.log(
      //   "Loading file: " +
      //     url +
      //     ".\nLoaded " +
      //     itemsLoaded +
      //     " of " +
      //     itemsTotal +
      //     " files."
      // );
    };
    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      // console.log(
      //   "Loading file: " +
      //     url +
      //     ".\nLoaded " +
      //     itemsLoaded +
      //     " of " +
      //     itemsTotal +
      //     " files."
      // );
      let pct = itemsLoaded / 15.0;
      $(".bar").css("width", `${pct * 100}%`);
    };
    manager.onLoad = () => {
      console.log("Loading complete!");
      game.loaded = true;
    };
    manager.onError = (url) => {
      console.log("There was an error loading " + url);
    };

    const loader = new THREE.FBXLoader(manager);
    const game = this;

    loader.load(
      `${this.assetsPath}fbx/ize_walk.fbx`,
      function (object) {
        object.mixer = new THREE.AnimationMixer(object);
        object.mixer.addEventListener("finished", function (e) {
          game.action = "ize_idle_rig";
        });
        object.castShadow = true;
        const scl = 0.6;
        object.scale.set(scl, scl, scl);
        object.position.set(100, 0, 100);
        object.rotation.set(0, -90, 0);

        game.player.mixer = object.mixer;
        game.player.root = object.mixer.getRoot();

        object.name = "Character";

        object.traverse(function (child) {
          if (child.isMesh) {
            const oldMat = child.material;
            const izeMaterial = new THREE.MeshPhysicalMaterial({
              map: oldMat.map,
              emissive: 0xffffff,
              emissiveMap: oldMat.map,
              envMap: hdrLoader,
              skinning: true,
              roughness: 0.3,
          //    reflectivity: 1,
              metalness: 0.025,
              clearcoat: 1,
              clearcoatRoughness: 0.5,
            });
            child.material = izeMaterial;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        game.scene.add(object);
        game.player.object = object;
        game.player.walk = object.animations[0];

        game.joystick = new JoyStick({
          onMove: game.playerControl,
          game: game,
        });

        game.createCameras();
        game.loadEnvironment(loader);
      },
      null,
      this.onError
    );

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true });
    this.renderer.gammaOutput = true;
    this.renderer.gammaFactor = 0.85;
    this.renderer.toneMappingExposure = 0.75;
  //  this.renderer.texture.encoding = THREE.sRGBEncoding
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
    this.renderer.shadowMapDebug = false;
    this.container.appendChild(this.renderer.domElement);

    // postprocessing
    this.composer = new THREE.EffectComposer(this.renderer);
    let renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    //outline
    this.outlinePass = new THREE.OutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.scene,
      this.camera
    );
    this.outlinePass.renderToScreen = true;
    this.composer.addPass(this.outlinePass);


    //fxaa
    // this.effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
    // this.effectFXAA.uniforms["resolution"].value.set(
    //   1 / window.innerWidth,
    //   1 / window.innerHeight
    // );
    // this.effectFXAA.renderToScreen = true;
    // this.composer.addPass(this.effectFXAA);


    // // LUT
    // $.get(`${this.assetsPath}IZE_LUT_1.lut1.cube`, function(data) {
    //    let lutString = data;
    //    let lutTexture = lutStringToTexture(lutString, 33);
    //    console.log(lutTexture)
    // }, 'text');
    //


  //  let gammaPass = new THREE.ShaderPass (THREE.GammaCorrectionShader);
  //  gammaPass.renderToScreen = true;
//    this.composer.addPass(gammaPass);

//BLOOM
   //  let bloomPass = new THREE.UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
   //   bloomPass.threshold = 0.1;
		// bloomPass.strength = 0.225;
		// bloomPass.radius = 1;
   //  bloomPass.renderToScreen = true;
   // this.composer.addPass(bloomPass);


    // let horizontalBlur = new THREE.ShaderPass(THREE.HorizontalBlurShader);
    // this.composer.addPass(horizontalBlur);
    // let verticalBlur = new THREE.ShaderPass(THREE.VerticalBlurShader);
    // this.composer.addPass(verticalBlur);
    // let effectSobel = new THREE.ShaderPass(THREE.SobelOperatorShader);
    // effectSobel.renderToScreen = true;
    // effectSobel.uniforms.resolution.value.x = window.innerWidth;
    // effectSobel.uniforms.resolution.value.y = window.innerHeight;
    // this.composer.addPass(effectSobel);

    window.addEventListener(
      "resize",
      function () {
        game.onWindowResize();
      },
      false
    );

    // stats
    if (this.debug) {
      this.stats = new Stats();
      this.container.appendChild(this.stats.dom);
    }

    // init overlay

    document.getElementById('init-overlay').addEventListener("click", (e) => {
      if(this.loaded) {
        $("#init-overlay").addClass("fade-in");
        let video = document.getElementById("video");
        video.play();
        setInterval(() => {
          $("#init-overlay").hide();
        }, 2000);
      }

    });

    document.getElementById('init-overlay').addEventListener("touchstart", (e) => {
      if(this.loaded) {
        $("#init-overlay").addClass("fade-in");
        let video = document.getElementById("video");
        video.play();
        setInterval(() => {
          $("#init-overlay").hide();
        }, 2000);
      }

    });

    // menu
    // let menuItems = document.getElementsByClassName("menu-item");
    // for (let item of menuItems) {
    //   item.addEventListener("click", () => {
    //     $(".section").hide();
    //     let id = item.children[0].getAttribute("href").substring(1);
    //     $(`#section-${id}`).show();
    //   });
    // }
  }

  loadEnvironment(loader) {
    const game = this;

    let hdrLoader = new THREE.CubeTextureLoader()
    .setPath(`assets/cubeMap/`)
    .load( [
    'px.png',
    'nx.png',
    'py.png',
    'ny.png',
    'pz.png',
    'nz.png'
  ] );

    loader.load(
      `${this.assetsPath}fbx/environment6.fbx`,
      function (object) {
        game.scene.add(object);
        game.fans = [];

        object.receiveShadow = true;
        object.name = "Environment";

        // let video = document.getElementById("video");
        // video.play();

        let videoTexture = new THREE.VideoTexture(video);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.maxFilter = THREE.LinearFilter;
        videoTexture.repeat.set(1, 1.8);
        videoTexture.offset.set(0, -0.5);

        let videoMaterial = new THREE.MeshStandardMaterial({
          map: videoTexture,
          emissive: 0xffffff,
          emissiveMap: videoTexture,
          overdraw: true,
          metalness: 0.7,
        });

        object.traverse(function (child) {
          if (child.isMesh) {
            if (child.name.includes("main")) {
              const oldMat = child.material;
              let imgTexture = new THREE.TextureLoader().load(`assets/fbx/environment_main_tex.png`);
              const newMat = new THREE.MeshStandardMaterial({
                map: imgTexture,
                emissive: 0x919191,
                emissiveMap: imgTexture,
                envMap: hdrLoader,
                skinning: false,
                roughness: 0.5,
              //  reflectivity: 1,
                metalness: 0.1,
              });
              child.material = newMat;
              child.castShadow = true;
              child.receiveShadow = true;
              child.material.side = THREE.DoubleSide;
            } else if (child.name.includes("ment_proxy")) {
              child.material.visible = false;
              game.environmentProxy = child;
            } else if (child.name.includes("laptop")) {
              game.laptop = child;
              const oldMat = child.material;
              let iceblockTexture = new THREE.TextureLoader().load('assets/fbx/iceblock_tex.png');
              const newiceblockMat = new THREE.MeshStandardMaterial({
                map: iceblockTexture,
                emissive: 0xffffff,
                emissiveMap: iceblockTexture,
                envMap: hdrLoader,
                skinning: false,
                roughness: 0.35,
                //reflectivity: 1,
                metalness: 0,
              });
              child.material = newiceblockMat;

            } else if (child.name.includes("tv_screen")) {
              child.material = videoMaterial;
              game.tv = child;
            } else if (child.name.includes("poster")) {
              game.poster = child;
              const oldMat = child.material;
              let posterTexture = new THREE.TextureLoader().load('assets/fbx/tourposter.png');
              const posterMat = new THREE.MeshStandardMaterial({
                map: posterTexture,
                emissive: 0xffffff,
                emissiveMap: posterTexture,
                skinning: false,
              });
              child.material = posterMat;

            } else if (child.name.includes("speakers")) {
              game.speakers = child;
            } else if (child.name.includes("tanktop")) {
              game.tanktop = child;
            }
          }
        });

        game.loadNextAnim(loader);
      },
      null,
      this.onError
    );
  }

  createDummyEnvironment() {
    const env = new THREE.Group();
    env.name = "Environment";
    this.scene.add(env);

    const geometry = new THREE.BoxBufferGeometry(150, 150, 150);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    for (let x = -1000; x < 1000; x += 300) {
      for (let z = -1000; z < 1000; z += 300) {
        const block = new THREE.Mesh(geometry, material);
        block.position.set(x, 75, z);
        env.add(block);
      }
    }

    this.environmentProxy = env;
  }

  playerControl(forward, turn) {
    turn = -turn;

    if (forward == 0 && turn == 0) {
      delete this.player.move;
    } else {
      this.player.move = { forward, turn };
    }

    if (forward > 0) {
      if (this.player.action != "walk" && this.player.action != "run")
        this.action = "walk";
    } else if (forward < -0.2) {
      if (this.player.action != "walk") this.action = "walk";
    } else {
      if (this.player.action == "walk" || this.player.action == "run")
        this.action = "ize_idle_rig";
    }

    // console.log(this.player.object.position)
  }

  createCameras() {
    const back = new THREE.Object3D();
    back.position.set(0, 100, -250);
    back.parent = this.player.object;
    const wide = new THREE.Object3D();
    wide.position.set(178, 139, 465);
    wide.parent = this.player.object;

    this.player.cameras = { back, wide };
    game.activeCamera = game.player.cameras.back;
  }

  loadNextAnim(loader) {
    let anim = this.anims.pop();
    const game = this;
    loader.load(
      `${this.assetsPath}fbx/${anim}.fbx`,
      function (object) {
        game.player[anim] = object.animations[0];

        // Filter out track names
        const tracks = object.animations[0].tracks;
        for (let i = tracks.length - 1; i >= 0; i--) {
          const track = tracks[i];
          if (track.name.includes("_end")) {
            object.animations[0].tracks.splice(i, 1);
          }
          if (track.name.includes("mixamorig_")) {
            object.animations[0].tracks[i].name = track.name.replace(
              "mixamorig_",
              ""
            );
          }
        }

        if (game.anims.length > 0) {
          game.loadNextAnim(loader);
        } else {
          delete game.anims;
          game.action = "ize_idle_rig";
          game.initPlayerPosition();
          game.mode = game.modes.ACTIVE;
        }
      },
      null,
      this.onError
    );
  }

  initPlayerPosition() {
    //cast down
    const dir = new THREE.Vector3(0, -1, 0);
    const pos = this.player.object.position.clone();
    // pos.y += 300;
    const raycaster = new THREE.Raycaster(pos, dir);
    const gravity = 30;
    const box = this.environmentProxy;

    const intersect = raycaster.intersectObject(box);
    if (intersect.length > 0) {
      this.player.object.position.y = pos.y - intersect[0].distance;
    }
  }

  getMousePosition(clientX, clientY) {
    const pos = new THREE.Vector2();
    pos.x = (clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    pos.y = -(clientY / this.renderer.domElement.clientHeight) * 2 + 1;
    return pos;
  }

  showMessage(msg, fontSize = 20, onOK = null) {
    const txt = document.getElementById("message_text");
    txt.innerHTML = msg;
    txt.style.fontSize = fontSize + "px";
    const btn = document.getElementById("message_ok");
    const panel = document.getElementById("message");
    const game = this;
    if (onOK != null) {
      btn.onclick = function () {
        panel.style.display = "none";
        onOK.call(game);
      };
    } else {
      btn.onclick = function () {
        panel.style.display = "none";
      };
    }
    panel.style.display = "flex";
  }

  // loadJSON(name, callback) {
  //   var xobj = new XMLHttpRequest();
  //   xobj.overrideMimeType("application/json");
  //   xobj.open("GET", `${name}.json`, true); // Replace 'my_data' with the path to your file
  //   xobj.onreadystatechange = function () {
  //     if (xobj.readyState == 4 && xobj.status == "200") {
  //       // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
  //       callback(xobj.responseText);
  //     }
  //   };
  //   xobj.send(null);
  // }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);

    // this.effectFXAA.uniforms["resolution"].value.set(
    //   1 / window.innerWidth,
    //   1 / window.innerHeight
    // );
  }

  set action(name) {
    if (this.player.action == name) return;
    const anim = this.player[name];
    const action = this.player.mixer.clipAction(anim, this.player.root);
    this.player.mixer.stopAllAction();
    this.player.action = name;
    action.timeScale =
      name == "walk" &&
      this.player.move != undefined &&
      this.player.move.forward < 0
        ? -0.3
        : 1;
    action.time = 0;
    action.fadeIn(0.5);
    if (name == "push-button" || name == "gather-objects")
      action.loop = THREE.LoopOnce;
    action.play();
    this.player.actionTime = Date.now();
  }

  movePlayer(dt) {
    const pos = this.player.object.position.clone();
    pos.y += 60;
    let dir = new THREE.Vector3();
    this.player.object.getWorldDirection(dir);
    if (this.player.move.forward < 0) dir.negate();
    let raycaster = new THREE.Raycaster(pos, dir);
    let blocked = false;
    const box = this.environmentProxy;

    if (this.environmentProxy != undefined) {
      const intersect = raycaster.intersectObject(box);
      if (intersect.length > 0) {
        if (intersect[0].distance < 50) blocked = true;
      }
    }

    if (!blocked) {
      if (this.player.move.forward > 0) {
        const speed = this.player.action == "run" ? 200 : 100;
        this.player.object.translateZ(dt * speed);
      } else {
        this.player.object.translateZ(-dt * 30);
      }
    }

    if (this.environmentProxy != undefined) {
      //cast left
      dir.set(-1, 0, 0);
      dir.applyMatrix4(this.player.object.matrix);
      dir.normalize();
      raycaster = new THREE.Raycaster(pos, dir);

      let intersect = raycaster.intersectObject(box);
      if (intersect.length > 0) {
        if (intersect[0].distance < 50)
          this.player.object.translateX(50 - intersect[0].distance);
      }

      //cast right
      dir.set(1, 0, 0);
      dir.applyMatrix4(this.player.object.matrix);
      dir.normalize();
      raycaster = new THREE.Raycaster(pos, dir);

      intersect = raycaster.intersectObject(box);
      if (intersect.length > 0) {
        if (intersect[0].distance < 50)
          this.player.object.translateX(intersect[0].distance - 50);
      }

      //cast down
      dir.set(0, -1, 0);
      pos.y += 200;
      raycaster = new THREE.Raycaster(pos, dir);
      const gravity = 30;

      intersect = raycaster.intersectObject(box);
      if (intersect.length > 0) {
        const targetY = pos.y - intersect[0].distance;
        if (targetY > this.player.object.position.y) {
          //Going up
          this.player.object.position.y =
            0.8 * this.player.object.position.y + 0.2 * targetY;
          this.player.velocityY = 0;
        } else if (targetY < this.player.object.position.y) {
          //Falling
          if (this.player.velocityY == undefined) this.player.velocityY = 0;
          this.player.velocityY += dt * gravity;
          this.player.object.position.y -= this.player.velocityY;
          if (this.player.object.position.y < targetY) {
            this.player.velocityY = 0;
            this.player.object.position.y = targetY;
          }
        }
      }
    }
  }

  animate() {
    const game = this;
    const dt = this.clock.getDelta();

    requestAnimationFrame(function () {
      game.animate();
    });

    if (this.tweens.length > 0) {
      this.tweens.forEach(function (tween) {
        tween.update(dt);
      });
    }

    if (this.player.mixer != undefined && this.mode == this.modes.ACTIVE) {
      this.player.mixer.update(dt);
    }

    if (this.player.action == "walk") {
      const elapsedTime = Date.now() - this.player.actionTime;
      // if (elapsedTime > 1000 && this.player.move.forward > 0)
      //   this.action = "run";
    }
    if (this.player.move != undefined) {
      if (this.player.move.forward != 0) this.movePlayer(dt);
      this.player.object.rotateY(this.player.move.turn * dt);
    }

    if (
      this.player.cameras != undefined &&
      this.player.cameras.active != undefined
    ) {
      this.camera.position.lerp(
        this.player.cameras.active.getWorldPosition(new THREE.Vector3()),
        this.cameraFade
      );
      let pos;
      if (this.cameraTarget != undefined) {
        this.camera.position.copy(this.cameraTarget.position);
        pos = this.cameraTarget.target;
      } else {
        pos = this.player.object.position.clone();
        pos.y += 60; // Edit this line to adjust camera Y position
      }
      this.camera.lookAt(pos);
    }

    let trigger = false;

    if (!trigger) delete this.onAction;

    if (this.tv !== undefined) {
      const dist = this.tv.position.distanceTo(game.player.object.position);
      if (dist < 250) {
        // near tv
        $("#menu-video, #bottom-title-video, #section-video").addClass("highlighted");
        this.highlighted = "video";
        this.outlinePass.selectedObjects = [this.tv];
      } else {
        $("#menu-video, #bottom-title-video, #section-video").removeClass("highlighted");
        if (this.highlighted === "video") {
          this.outlinePass.selectedObjects = [];
          this.highlighted = "";
        }
      }
    }

    if (this.laptop !== undefined) {
      const dist = this.laptop.position.distanceTo(game.player.object.position);
      if (dist < 250) {
        // near laptop
        $("#menu-contact, #bottom-title-contact, #section-contact").addClass("highlighted");
        this.highlighted = "contact";
        this.outlinePass.selectedObjects = [this.laptop];
      } else {
        $("#menu-contact, #bottom-title-contact, #section-contact").removeClass("highlighted");
        if (this.highlighted === "contact") {
          this.outlinePass.selectedObjects = [];
          this.highlighted = "";
        }
      }
    }

    if (this.poster !== undefined) {
      const dist = this.poster.position.distanceTo(game.player.object.position);
      if (dist < 220) {
        // near poster
        $("#menu-tour, #bottom-title-tour, #section-tour").addClass("highlighted");
        this.highlighted = "tour";
        this.outlinePass.selectedObjects = [this.poster];
      } else {
        $("#menu-tour, #bottom-title-tour, #section-tour").removeClass("highlighted");
        if (this.highlighted === "tour") {
          this.outlinePass.selectedObjects = [];
          this.highlighted = "";
        }
      }
    }

    if (this.speakers !== undefined) {
      const dist = this.speakers.position.distanceTo(
        game.player.object.position
      );
      if (dist < 450) {
        // near poster
        $("#menu-music, #bottom-title-music, #section-music").addClass("highlighted");
        this.highlighted = "music";
        this.outlinePass.selectedObjects = [this.speakers];
      } else {
        $("#menu-music, #bottom-title-music, #section-music").removeClass("highlighted");
        if (this.highlighted === "music") {
          this.outlinePass.selectedObjects = [];
          this.highlighted = "";
        }
      }
    }

    if (this.tanktop !== undefined) {
      const dist = this.tanktop.position.distanceTo(
        game.player.object.position
      );
      if (dist < 50) {
        // near poster
        $("#menu-merch, #bottom-title-merch, #section-merch").addClass("highlighted");
        this.highlighted = "merch";
        this.outlinePass.selectedObjects = [this.tanktop];
      } else {
        $("#menu-merch, #bottom-title-merch, #section-merch").removeClass("highlighted");
        if (this.highlighted === "merch") {
          this.outlinePass.selectedObjects = [];
          this.highlighted = "";
        }
      }
    }

    this.composer.render();
    // this.renderer.render(this.scene, this.camera);

    if (this.stats != undefined) this.stats.update();
  }

  onError(error) {
    const msg = console.error(JSON.stringify(error));
    console.error(error.message);
  }


}

// function lutStringToTexture ( lutString, lutSize ) {
//   var totalNumberOfComponents = lutSize * lutSize * lutSize * 4;
//   var floatsIdx = 0;
//   var floatArray = lutString
//           .split( '\n' )
//           .map( function ( line ) {
//               return line.split( ' ' );
//           })
//           .filter( function ( components ) {
//               return components.length === 3;
//           })
//           .reduce( function ( floats, components, index ) {
//               components.forEach( function ( v, idx ) {
//                   floats[ floatsIdx++ ] = v;
//                   if ( idx===2 ) {
//                       floats[ floatsIdx++ ] = 1.0;
//                   }
//               });
//               return floats;
//           }, new Float32Array( totalNumberOfComponents ) );
//
//   var texture = new THREE.DataTexture( floatArray, lutSize * lutSize, lutSize );
//   texture.type = THREE.FloatType;
//   texture.format = THREE.RGBAFormat;
//
//   return texture;
// }
