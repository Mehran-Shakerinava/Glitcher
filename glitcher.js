'use strict';

window.addEventListener('load', function() {

    var TILE_W = 32;
    var CANVAS_W = 224;
    var CANVAS_H = 126;
    var SCENE_W = Math.floor(CANVAS_W / TILE_W) + 1;
    var SCENE_H = Math.ceil(CANVAS_H / TILE_W);
    var OFFSET_Y = (SCENE_H * TILE_W - CANVAS_H) / 2;

    var ctxs = {};

    function addCanvas(name, z) {
        var canvas = document.createElement('canvas');
        document.body.appendChild(canvas);
        canvas.style['z-index'] = z;
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        ctxs[name] = canvas.getContext('2d');
    };

    addCanvas('main', 1);
    addCanvas('ui', 2);

    var ctx = ctxs.main;
    ctx.canvas.style['background'] = '#401910';

    var IMAGES = {};
    IMAGES.fossils = document.getElementById('fossils');
    IMAGES.brickWall = document.getElementById('brick-wall');
    IMAGES.darkBlueGranite = document.getElementById('dark-blue-granite');
    IMAGES.darkBlueGranite2 = document.getElementById('dark-blue-granite-2');

    var guy = {
        x: 0,
        y: -TILE_W / 2,
        V: 64,
        J: 54,
        anim: {
            /* should correlate with speed */
            FPS: 64 / 3,
            frames: [],
            t: 0
        },
        init: function() {
            var spritesheet = document.getElementById('dark-devil');
            var len = spritesheet.width / TILE_W;
            for (var i = 0; i < len; i += 1) {
                var canvas = document.createElement('canvas');
                canvas.width = TILE_W;
                canvas.height = TILE_W;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(spritesheet, i * TILE_W, 0,
                    TILE_W, TILE_W, 0, 0, TILE_W, TILE_W);
                this.anim.frames.push(canvas);
            }
        },
        render: function(ctx, cam) {
            var x = this.x - cam.x + CANVAS_W / 2 - TILE_W / 2;
            var y = this.y - cam.y + CANVAS_H / 2 - TILE_W / 2;

            var frame = Math.floor(this.anim.t * this.anim.FPS);
            var img = this.anim.frames[frame];
            ctx.drawImage(img, x, y);
        },
        update: function(dt) {
            this.x += dt * this.V;

            this.anim.t += dt;
            this.anim.t %= this.anim.frames.length / this.anim.FPS;
        },
        jump: function() {
            var frame = Math.floor(this.anim.t * this.anim.FPS);
            var img = this.anim.frames[frame];
            effect.add(img, this.x, this.y);

            this.x += this.J;

            audio.play('jump');
        }
    };

    guy.init();

    var cam = {
        AHEAD: 64,
        A: 64,
        v: 32,
        x: CANVAS_W / 2 + TILE_W / 2,
        y: TILE_W - CANVAS_H / 2 - OFFSET_Y,
        update: function(dt, guy) {
            this.x += this.v * dt;

            var v = this.v - guy.V;
            var x = guy.x + this.AHEAD - this.x;
            var dx = sign(v) * 0.5 * v * v / this.A;

            if (x * dx >= 0 && Math.abs(dx) <= Math.abs(x)) {
                /* accelerate */
                this.v += sign(v) * dt * this.A;
            } else {
                /* decelerate */
                this.v -= sign(v) * dt * this.A;
            }
        }
    };

    var scene = {
        ceilImages: [IMAGES.darkBlueGranite2],
        bgImages: [IMAGES.fossils],
        floorImages: [IMAGES.darkBlueGranite],
        x: 0,
        ceil: [],
        bg: [],
        floor: [],
        genTiles: function() {
            this.ceil.push(randomInt(this.ceilImages.length));
            this.floor.push(randomInt(this.floorImages.length));
            for (var j = 0; j < SCENE_H - 2; j += 1) {
                this.bg[j].push(randomInt(this.bgImages.length));
            }
        },
        popTiles: function() {
            this.ceil.shift();
            this.floor.shift();
            for (var j = 0; j < SCENE_H - 2; j += 1) {
                this.bg[j].shift();
            }
        },
        init: function() {
            for (var i = 0; i < SCENE_H - 2; i += 1) {
                this.bg.push([]);
            }
            for (var i = 0; i < SCENE_W; i += 1) {
                this.genTiles();
            }
        },
        update: function(cam) {
            if (this.x + 32 < cam.x - CANVAS_W / 2) {
                this.x += 32;
                this.popTiles();
                this.genTiles();
            }
        },
        renderCol: function(ctx, cam, i) {
            var x = this.x + TILE_W * i - cam.x + CANVAS_W / 2;
            ctx.drawImage(this.ceilImages[this.ceil[i]],
                x, -OFFSET_Y);
            ctx.drawImage(this.floorImages[this.floor[i]],
                x, TILE_W * (SCENE_H - 1) - OFFSET_Y);
            for (var j = 1; j < SCENE_H - 1; j += 1) {
                ctx.drawImage(this.bgImages[this.bg[j - 1][i]],
                    x, TILE_W * j - OFFSET_Y);
            }
        },
        render: function(ctx, cam) {
            for (var i = 0; i < SCENE_W; i += 1) {
                this.renderCol(ctx, cam, i);
            }
        }
    };

    var obstacles = {
        PROB: 1,
        DIST: 48,
        walls: [-1000],
        wallImages: [IMAGES.brickWall],
        update: function(dt) {
            var wallEnd = this.walls[this.walls.length - 1] +
                TILE_W;
            var camEnd = cam.x + CANVAS_W / 2;
            var camBegin = cam.x - CANVAS_W / 2;
            /* TODO: check prev walls and affect random */
            if (wallEnd + this.DIST < camEnd &&
                Math.random() < this.PROB * dt) {
                this.walls.push(Math.ceil(camEnd));
            }
            while (this.walls.length > 1 &&
                this.walls[0] + 32 < camBegin) {
                this.walls.shift();
            }
        },
        renderWall: function(ctx, x) {
            for (var i = 1; i < SCENE_H - 1; i += 1) {
                ctx.drawImage(this.wallImages[randomInt(this.wallImages
                        .length)], x - cam.x + CANVAS_W / 2,
                    TILE_W * i - OFFSET_Y);
            }
        },
        render: function(ctx, cam) {
            for (var i = 0; i < this.walls.length; i += 1) {
                this.renderWall(ctx, this.walls[i]);
            }
        },
        collision: function(guy) {
            var le = guy.x - 5;
            var ri = guy.x + 5;

            for (var i = 0; i < this.walls.length; i += 1) {
                if (ri < this.walls[i]) {
                    break;
                }
            }

            if (i == 0) {
                return false;
            }

            var wall = this.walls[i - 1];
            if (le < wall + TILE_W) {
                return true;
            }
            return false;
        }
    };

    var effect = {
        list: [],
        glitch: function(ctx, img, x, y) {
            var w = img.width;
            var h = img.height;
            var rects = Math.random() * 13;
            for (var i = 0; i < rects; i++) {
                var dx = Math.random() * 0.2 * w;
                var dy = Math.random() * h;
                var spliceW = w - dx;
                var spliceH = Math.min(randomInt(h / 3) + 5, h - dy);
                ctx.drawImage(img, 0, dy, spliceW, spliceH,
                    x + dx, y + dy, spliceW, spliceH);
                ctx.drawImage(img, spliceW, dy, dx, spliceH,
                    x, y + dy, dx, spliceH);
            }
        },
        add: function(img, x, y) {
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');

            this.list.push({
                x: x,
                y: y,
                img: img,
                ctx: ctx
            });
        },
        update: function(cam) {
            while (this.list.length != 0 &&
                this.list[0].x + TILE_W / 2 < cam.x - CANVAS_W / 2) {
                this.list.shift();
            }
            for (var i = 0; i < this.list.length; i += 1) {
                var inst = this.list[i];
                var ctx = inst.ctx;
                if (Math.random() < 0.05) {
                    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                    this.glitch(ctx, inst.img, 0, 0);
                }
            }
        },
        render: function(ctx, cam) {
            for (var i = 0; i < this.list.length; i += 1) {
                var inst = this.list[i];
                var x = inst.x - cam.x + CANVAS_W / 2 - TILE_W / 2;
                var y = inst.y - cam.y + CANVAS_H / 2 - TILE_W / 2;
                if (Math.random() < 0.9) {
                    ctx.drawImage(inst.ctx.canvas, x, y);
                }
            }
        }
    }

    var audio = {
        MUTATIONS: 3,
        settings: {
            'jump': [0, 0.11, 0.14, 0.20, 0.26, 0.34, 0.085, 0.21, 0,
                0.55, 0.51, -0.34, 0.26, 0.13, 0.01, 0.19, -0.10,
                0.17, 0.88, -0.15, 0.20, , -0.28, 0.35
            ]
        },
        audios: {},
        init: function() {
            for (var audioName in this.settings) {
                var settings = this.settings[audioName];
                var audios = [];
                this.audios[audioName] = audios;
                for (var i = 0; i < this.MUTATIONS; i += 1) {
                    var audio = new Audio();
                    audio.src = jsfxr(this.mutate(settings));
                    audios.push(audio);
                }
            }
        },
        mutate: function(settings) {
            for (var i = 0; i < settings.length; i += 1) {
                if (Math.random() < 0.5 && settings[i]) {
                    settings[i] += Math.random() * 0.1 - 0.05;
                }
            }
            return settings;
        },
        play: function(audioName) {
            this.audios[audioName][randomInt(this.MUTATIONS)].play();
        }
    };

    audio.init();

    var pixelFont = {
        CHAR_W: 3,
        CHAR_H: 5,
        chars: {},
        init: function() {
            var digits = document.getElementById('digits');
            for (var i = 0; i < 10; i += 1) {
                var canvas = document.createElement('canvas');
                canvas.width = this.CHAR_W;
                canvas.height = this.CHAR_H;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(digits, i * 3, 0, this.CHAR_W,
                    this.CHAR_H, 0, 0, this.CHAR_W, this.CHAR_H
                );
                this.chars[i] = canvas;
            }
        },
        write: function(ctx, text, x, y) {
            text = text.toString();
            x -= text.length * (this.CHAR_W + 1) / 2 - 0.5;
            y -= this.CHAR_H / 2;
            for (var i = 0; i < text.length; i += 1) {
                ctx.drawImage(this.chars[text.charAt(i)], x, y);
                x += this.CHAR_W + 1;
            }
        }
    };

    pixelFont.init();

    var score = {
        startTime: 0,
        dispScore: -1,

        init: function() {
            this.startTime = performance.now();
        },

        render: function(ctx) {
            var curScore = Math.floor((performance.now() -
                this.startTime) / 1000);
            if (curScore != this.dispScore) {
                ctx.clearRect(0, 0, CANVAS_W, TILE_W);
                this.dispScore = curScore;
                pixelFont.write(ctx, curScore, CANVAS_W / 2,
                    TILE_W / 2);
            }
        }
    };

    document.addEventListener('touchstart', function(e) {
        guy.jump();
    });

    document.addEventListener('keydown', function(e) {
        if (e.code == 'Space') {
            guy.jump();
        }
    });

    function sign(x) {
        return (x < 0 ? -1 : 1);
    }

    function randomInt(max) {
        return Math.floor(Math.random() * max);
    }

    scene.init();

    var preTime;

    function mainLoop(timestamp) {
        if (!preTime) {
            preTime = timestamp;
        }

        var dt = timestamp - preTime;
        preTime = timestamp;
        dt *= 0.001;

        if (dt > 0.1) {
            dt = 0.016;
        }

        guy.update(dt);
        cam.update(dt, guy);
        scene.update(cam);
        effect.update(cam);
        obstacles.update(dt);

        var ctx = ctxs.ui;
        score.render(ctx);

        ctx = ctxs.main;
        scene.render(ctx, cam);
        obstacles.render(ctx, cam);
        effect.render(ctx, cam);
        guy.render(ctx, cam);

        if (obstacles.collision(guy)) {
            alert("GAME OVER!");
        } else {
            requestAnimationFrame(mainLoop);
        }
    }

    score.init();
    requestAnimationFrame(mainLoop);
});
