//Main class
'use strict';
const scale = 10; //разрешение 1 пикселя
const around = [{
        dx: -1,
        dy: 0
    },
    {
        dx: 1,
        dy: 0
    },
    {
        dx: 0,
        dy: -1
    },
    {
        dx: 0,
        dy: 1
    }
];

class Picture {
    constructor(width, height, pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }

    static empty(width, height, color) {
        let pixels = new Array(width * height).fill(color);
        return new Picture(width, height, pixels);
    }
    pixel(x, y) {
        return this.pixels[x + y * this.width];
    }
    draw(pixels) {
        let copy = this.pixels.slice();
        for (let { x, y, color }
            of pixels) {
            copy[x + y * this.width] = color;
        }
        return new Picture(this.width, this.height, copy);
    }
}

function updateState(state, action) {
    return Object.assign({}, state, action); //{...state,  ...action};
}

function elt(type, props, ...children) {
    let dom = document.createElement(type);
    if (props) Object.assign(dom, props);
    for (let child of children) {
        if (typeof child != "string") dom.appendChild(child);
        else dom.appendChild(document.createTextNode(child));
    }
    return dom;
}

class PictureCanvas {
    constructor(picture, pointerDown) {
        this.dom = elt("canvas", {
            onmousedown: event => this.mouse(event, pointerDown),
            ontouchstart: event => this.touch(event, pointerDown)
        });
        this.syncState(picture);
    }
    syncState(picture) {
        if (this.picture == picture) return;
        this.picture = picture;
        drawPicture(this.picture, this.dom, scale);
    }
}

PictureCanvas.prototype.mouse = function(downEvent, onDown) {
    if (downEvent.button != 0) return;
    let pos = pointerPosition(downEvent, this.dom);
    let onMove = onDown(pos);
    if (!onMove) return;
    let move = moveEvent => {
        if (moveEvent.buttons == 0) {
            this.dom.removeEventListener("mousemove", move);
        } else {
            let newPos = pointerPosition(moveEvent, this.dom);
            if (newPos.x == pos.x && newPos.y == pos.y) return;
            pos = newPos;
            onMove(newPos);
        }
    };
    this.dom.addEventListener("mousemove", move);
};

function drawPicture(picture, canvas, scale) {
    canvas.width = picture.width * scale;
    canvas.height = picture.height * scale;
    let cx = canvas.getContext("2d");
    for (let y = 0; y < picture.height; y++) {
        for (let x = 0; x < picture.width; x++) {
            cx.fillStyle = picture.pixel(x, y);
            cx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

function pointerPosition(pos, domNode) {
    let rect = domNode.getBoundingClientRect();
    return {
        x: Math.floor((pos.clientX - rect.left) / scale),
        y: Math.floor((pos.clientY - rect.top) / scale)
    };
}

PictureCanvas.prototype.touch = function(startEvent, onDown) {
    let pos = pointerPosition(startEvent.touches[0], this.dom);
    let onMove = onDown(pos);
    startEvent.preventDefault();
    if (!onMove) return;
    let move = moveEvent => {
        let newPos = pointerPosition(moveEvent.touches[0], this.dom);
        if (newPos.x == pos.x && newPos.y == pos.y) return;
        pos = newPos;
        onМove(newPos);
    };
    let end = () => {
        this.dom.removeEventListener("touchmove", move);
        this.dom.removeEventListener("touchend", end);
    };
    this.dom.addEventListener("touchmove", move);
    this.dom.addEventListener("touchend", end);
}

class PixelEditor {
    constructor(state, config) {
        let { tools, controls, dispatch } = config;
        this.state = state;

        this.canvas = new PictureCanvas(state.picture, pos => {
            let tool = tools[this.state.tool];
            let onMove = tool(pos, this.state, dispatch);
            if (onMove) return pos => onMove(pos, this.state);
        });

        this.controls = controls.map(Control => new Control(state, config));
        this.dom = elt(
            "div", {},
            this.canvas.dom,
            elt("br"),
            ...this.controls.reduce((a, c) => a.concat(" ", c.dom), [])
        );
    }
    syncState(state) {
        this.state = state;
        this.canvas.syncState(state.picture);
        for (let ctrl of this.controls) ctrl.syncState(state);
    }
}

class ToolSelect {
    constructor(state, { tools, dispatch }) {
        this.select = elt(
            "select", {
                onchange: () =>
                    dispatch({
                        tool: this.select.value
                    })
            },
            ...Object.keys(tools).map(name =>
                elt(
                    "option", { selected: name == state.tool }, name
                )
            )
        );
        this.dom = elt("label", null, "Инструмент: ", this.select);
    }

    syncState(state) {
        this.select.value = state.tool;
    }
}

class ColorSelect {
    constructor(state, { dispatch }) {
        this.input = elt("input", {
            type: "color",
            value: state.color,
            onchange: () =>
                dispatch({
                    color: this.input.value
                })
        });
        this.dom = elt("label", null, "Цвет: ", this.input);
    }
    syncState(state) {
        this.input.value = state.color;
    }
}

class ClearButton {
    constructor(state, { dispatch }) {
        this.picture = state.picture;
        this.dom = elt(
            "button", {
                onclick: () => dispatch({
                    picture: Picture.empty(this.picture.width, this.picture.height, defaultColor)
                }),
            },
            "Очистить"
        );
    }

    syncState(state) {
        this.picture = state.picture;
    }
}

function draw(pos, state, dispatch) {
    function drawPixel({ x, y }, state) {
        let drawn = {
            x,
            y,
            color: state.color
        };
        dispatch({
            picture: state.picture.draw([drawn])
        });
    }
    drawPixel(pos, state);
    return drawPixel;
}

function rectangle(start, state, dispatch) {
    function drawRectangle(pos) {
        let xStart = Math.min(start.x, pos.x);
        let yStart = Math.min(start.y, pos.y);
        let xEnd = Math.max(start.x, pos.x);
        let yEnd = Math.max(start.y, pos.y);
        let drawn = [];
        for (let y = yStart; y <= yEnd; y++) {
            for (let x = xStart; x <= xEnd; x++) {
                drawn.push({
                    x,
                    y,
                    color: state.color
                });
            }
        }
        dispatch({
            picture: state.picture.draw(drawn)
        });
    }
    drawRectangle(start);

    return drawRectangle;
}


function fill({ x, y }, state, dispatch, pattern) {
    let targetColor = state.picture.pixel(x, y);
    let isPatternFill;
    if (pattern) {
        isPatternFill = true;
    }

    let drawn = [{
        x,
        y,
        color: isPatternFill ? pattern[(y % pattern.length)][(x % pattern.length)].color : state.color
    }];

    for (let done = 0; done < drawn.length; done++) {
        for (let { dx, dy }
            of around) {
            let x = drawn[done].x + dx,
                y = drawn[done].y + dy;
            if (
                x >= 0 &&
                x < state.picture.width &&
                y >= 0 &&
                y < state.picture.height && //Проверка на выход за рамки picture
                state.picture.pixel(x, y) == targetColor &&
                !drawn.some(p => p.x == x && p.y == y)
            ) {
                drawn.push({
                    x,
                    y,
                    color: isPatternFill ? pattern[y % pattern.length][x % pattern.length].color : state.color
                });
            }
        }
    }
    dispatch({
        picture: state.picture.draw(drawn)
    });
}

function fillWithPattern(pos, state, dispatch) {

    let targetColor = state.picture.pixel(pos.x, pos.y);

    let defaultFillPattern = [
        [{ color: targetColor }, { color: state.color }, { color: targetColor }],
        [{ color: state.color }, { color: targetColor }, { color: state.color }],
        [{ color: targetColor }, { color: state.color }, { color: targetColor }],
    ];

    fill({ x: pos.x, y: pos.y }, state, dispatch, defaultFillPattern);
}

function pick(pos, state, dispatch) {
    dispatch({
        color: state.picture.pixel(pos.x, pos.y)
    });
}

function line(start, state, dispatch) {

    //На основе замыкания
    function drawLine(pos) {

        let x0 = start.x;
        let y0 = start.y;
        let x1 = pos.x;
        let y1 = pos.y;
        let drawn = [];

        let dx = x1 - x0,
            dy = y1 - y0;

        let stepY = sign(dy);
        let stepX = sign(dx);

        if (dx < 0) dx = -dx; //равносильно Math.abs(dy) > Math.abs(dx); =>
        if (dy < 0) dy = -dy; //поэтому  dx = |dx|; dy = |dy|


        //определяем наклон отрезка
        let pdX = 0,
            pdY = 0,
            es = 0,
            m = 0;

        if (dx > dy) {
            pdX = stepX;
            pdY = 0;
            es = dy;
            m = dx;
        } else {
            pdX = 0;
            pdY = stepY;
            es = dx;
            m = dy;
        }

        let x = x0;
        let y = y0;

        let e = m / 2;

        drawn.push({
            x: x,
            y: y,
            color: state.color
        });

        for (let i = 0; i < m; i++) {
            e -= es;
            if (e < 0) {
                e += m;
                x += stepX
                y += stepY;
            } else {
                x += pdX;
                y += pdY;
            }

            drawn.push({
                x,
                y,
                color: state.color
            });
        }

        dispatch({
            picture: state.picture.draw(drawn)
        });
    }

    function sign(x) {
        return (x > 0) ? 1 : (x < 0) ? -1 : 0;
    }

    drawLine(start);

    return drawLine;
}

function circle(start, state, dispatch) {

    function drawCircle(pos) {

        let drawn = [];

        function draw8Pixels({ x, y }) {

            drawn.push({
                x: x + x0,
                y: y + y0,
                color: state.color
            });
            drawn.push({
                x: x + x0,
                y: -y + y0,
                color: state.color
            });
            drawn.push({
                x: -x + x0,
                y: y + y0,
                color: state.color
            });
            drawn.push({
                x: -x + x0,
                y: -y + y0,
                color: state.color
            });
            drawn.push({
                x: y + x0,
                y: x + y0,
                color: state.color
            });

            drawn.push({
                x: -y + x0,
                y: x + y0,
                color: state.color
            });
            drawn.push({
                x: y + x0,
                y: -x + y0,
                color: state.color
            });

            drawn.push({
                x: -y + x0,
                y: -x + y0,
                color: state.color
            });
        }

        let stepY = -1;
        let stepX = 1;



        let x0 = start.x;
        let y0 = start.y;

        let dx = pos.x - x0,
            dy = pos.y - y0;

        let R = Math.floor(Math.sqrt(dx * dx + dy * dy));

        let x = 0,
            y = R;
        let d = 3 - 2 * R;

        while (y >= x) {
            draw8Pixels({ x: x, y: y });
            if (d < 0) {
                d += 4 * x + 6;
            } else {
                d += 4 * (x - y) + 10;
                y += stepY;
            }

            x += stepX;
        }

        dispatch({
            picture: state.picture.draw(drawn)
        });
    }
    drawCircle(start);

    return drawCircle;
}

class SaveButton {
    constructor(state) {
        this.picture = state.picture;
        this.dom = elt(
            "button", {
                onclick: () => this.save()
            },
            "  Сохранить"
        );
    }

    save() {
        let canvas = elt("canvas");
        drawPicture(this.picture, canvas, 1);
        let link = elt("a", {
            href: canvas.toDataURL(),
            download: "pixelart.png"
        });
        console.log(link.href);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
    syncState(state) {
        this.picture = state.picture;
    }
}

class LoadButton {
    constructor(_, { dispatch }) {
        this.dom = elt(
            "button", {
                onclick: () => startLoad(dispatch)
            },
            "Загрузить"
        );
    }
    syncState() {}
}

function startLoad(dispatch) {
    let input = elt("input", {
        type: "file",
        onchange: () => finishLoad(input.files[0], dispatch)
    });
    document.body.appendChild(input);
    input.click();
    input.remove();
}

function finishLoad(file, dispatch) {
    if (file == null) return;
    let reader = new FileReader();
    reader.addEventListener("load", () => {
        let image = elt("img", {
            onload: () =>
                dispatch({
                    picture: pictureFromImage(image)
                }),
            src: reader.result
        });
    });
    console.log("URL file :");
    console.log(file);
    reader.readAsDataURL(file);
}

const minWidth = 100;
const maxHeight = 100;

function pictureFromImage(image) {
    let width = Math.min(minWidth, image.width);
    let height = Math.min(maxHeight, image.height);
    let canvas = elt("canvas", {
        width,
        height
    });
    let сx = canvas.getContext("2d");
    сx.drawImage(image, 0, 0);
    let pixels = [];
    let { data } = сx.getImageData(0, 0, width, height);

    for (let i = 0; i < data.length; i += 4) {
        let [r, g, b] = data.slice(i, i + 3);
        pixels.push("#" + hex(r) + hex(g) + hex(b));
    }
    return new Picture(width, height, pixels);

    function hex(n) {
        return n.toString(16).padStart(2, "0");
    }
}

function historyUpdateState(state, action) {
    if (action.undo == true) {
        if (state.done.length == 0) return state;
        return Object.assign({}, state, {
            picture: state.done[0],
            done: state.done.slice(1),
            doneAt: 0
        });
    } else if (action.picture && state.doneAt < Date.now() - 1000) {
        return Object.assign({}, state, action, {
            done: [state.picture, ...state.done],
            doneAt: Date.now()
        });
    } else {
        return Object.assign({}, state, action);
    }
}

class UndoButton {
    constructor(state, { dispatch }) {

        this.dom = elt("button", {
            onclick: () => dispatch({ undo: true }),
            disabled: state.done.length == 0
        }, " Отменить");
    }
    syncState(state) {
        this.dom.disabled = state.done.length == 0;
    }
}

const defaultColor = "#f0f0f0";
const startState = {
    tool: "draw",
    color: "#010101",
    picture: Picture.empty(60, 30, defaultColor),
    done: [],
    doneAt: 0
};

const baseTools = { draw, line, rectangle, circle, fill, fillWithPattern, pick };

const baseControls = [
    ToolSelect, ColorSelect, SaveButton, LoadButton, UndoButton, ClearButton
];

let sizeX,
    sizeY;

function startPixelEditor({
    state = startState,
    tools = baseTools,
    controls = baseControls
}, option = { sizeX: 60, sizeY: 30 }) {

    sizeX = option.sizeX;
    sizeY = option.sizeY;

    startState.picture = Picture.empty(sizeX, sizeY, defaultColor);

    let app = new PixelEditor(state, {
        tools,
        controls,
        dispatch(action) {
            state = historyUpdateState(state, action);
            app.syncState(state);
        }
    });
    return app.dom;
}