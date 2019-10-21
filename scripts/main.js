//@ts-check
'use strict';
const scale = 10; //разрешение 1 пикселя
// Массив ходов для заливки
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
    /**
     * 
     * @param {number} width 
     * @param {number} height 
     * @param {string[]} pixels 
     */
    constructor(width, height, pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }

    /**
     * @param {number} width
     * @param {number} height
     * @param {string} color
     */
    static empty(width, height, color) {
            let pixels = new Array(width * height).fill(color);
            return new Picture(width, height, pixels);
        }
        /**
         * @param {number} x
         * @param {number} y
         */
    pixel(x, y) {
            return this.pixels[x + y * this.width];
        }
        /**
         * @param {{ x: number, y: number, color: string }[]} pixels
         */
    draw(pixels) {
        let copy = this.pixels.slice();
        for (let { x, y, color }
            of pixels) {
            copy[x + y * this.width] = color;
        }
        return new Picture(this.width, this.height, copy);
    }
}

/**
 * @param {any} state
 * @param {any} action
 */
function updateState(state, action) {
    return {...state, ...action }; //Старый вариант => Object.assign({}, state, action); 
}

/**
 * @param {string} type
 * @param {*} [props]
 * @param {string[]} children
 * @returns {HTMLElement}
 */
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
    /**
     * @param {Picture} picture
     * @param {*} pointerDown
     */
    constructor(picture, pointerDown) {
            this.dom = elt("canvas",
                /**
                 * @param {MouseEvent} event
                 */
                /**
                 * @param {TouchEvent} event
                 */
                {
                    onmousedown: event => this.mouse(event, pointerDown),
                    ontouchstart: event => this.touch(event, pointerDown)
                });
            this.syncState(picture);
        }
        /**
         * @param {Picture} picture
         */
    syncState(picture) {
        if (this.picture == picture) return;
        if (!this.picture) {
            drawPicture(picture, this.dom, scale);
        } else {
            drawQuickPicture(picture, this.picture, this.dom, scale);
        }
        this.picture = picture;
    }
}

PictureCanvas.prototype.mouse =
    /**
     * @param {MouseEvent} downEvent
     * @param {any} onDown
     */
    function(downEvent, onDown) {
        if (downEvent.button != 0) return;
        let pos = pointerPosition(downEvent, this.dom);
        let onMove = onDown(pos);
        if (!onMove) return;
        /**
         * @param {any} moveEvent
         */
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

/**
 * @param {Picture} picture
 * @param {any} canvas
 * @param {number} scale
 */
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

/**
 * 
 * @param {Picture} pictureNew 
 * @param {Picture} pictureOld 
 * @param {*} canvas 
 * @param {number} scale 
 */
function drawQuickPicture(pictureNew, pictureOld, canvas, scale) {
    if (pictureNew.height != pictureOld.height || pictureNew.width != pictureOld.width) {
        drawPicture(pictureNew, canvas, scale);
        return;
    }
    let cx = canvas.getContext("2d");
    for (let y = 0; y < pictureNew.height; y++) {
        for (let x = 0; x < pictureNew.width; x++) {
            if (pictureNew.pixel(x, y) == pictureOld.pixel(x, y)) continue;
            cx.fillStyle = pictureNew.pixel(x, y);
            cx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

/**
 * @param {{ clientX: number; clientY: number; }} pos
 * @param {{ getBoundingClientRect: () => any; }} domNode
 */
function pointerPosition(pos, domNode) {
    let rect = domNode.getBoundingClientRect();
    return {
        x: Math.floor((pos.clientX - rect.left) / scale),
        y: Math.floor((pos.clientY - rect.top) / scale)
    };
}

PictureCanvas.prototype.touch =
    /**
     * @param {TouchEvent} startEvent
     * @param {(arg0: { x: number; y: number; }) => any} onDown
     */
    function(startEvent, onDown) {
        let pos = pointerPosition(startEvent.touches[0], this.dom);
        let onMove = onDown(pos);
        startEvent.preventDefault();
        if (!onMove) return;
        /**
         * @param {*} moveEvent
         */
        let move = moveEvent => {
            let newPos = pointerPosition(moveEvent.touches[0], this.dom);
            if (newPos.x == pos.x && newPos.y == pos.y) return;
            pos = newPos;
            onMove(newPos);
        };
        let end = () => {
            this.dom.removeEventListener("touchmove", move);
            this.dom.removeEventListener("touchend", end);
        };
        this.dom.addEventListener("touchmove", move);
        this.dom.addEventListener("touchend", end);
    }

class PixelEditor {
    /**
     * @param {{ tool?: string; color?: string; picture: Picture; done?: any[]; doneAt?: number; }} state
     * @param {{ tools: any; controls: any[]; dispatch: (any)=> void; }} config
     */
    constructor(state, config) {
            let { tools, controls, dispatch } = config;
            this.state = state;

            /**
             * @param {any} pos
             */
            this.canvas = new PictureCanvas(state.picture, pos => {
                let tool = tools[this.state.tool];
                //При взаимодействии с canvas выполняем соответствующий инструмент и смотрим, что он возвращает
                let onMove = tool(pos, this.state, dispatch);
                /**
                 * @param {{x:number, y:number}} pos
                 * Если функция-инструмент возвращает что-то(внутреннюю функцию) то выполняем ее заного
                 */
                if (onMove)
                    return pos => onMove(pos, this.state);
            });

            /**
             * @param {any} Control
             */
            // @ts-ignore
            this.controls = controls.map(Control => new Control(state, config));
            this.dom = elt(
                "div", {},
                // @ts-ignore
                this.canvas.dom,
                elt("br"),
                /**
                 * @param {{ concat: (arg0: string, arg1: any) => void; }} a
                 * @param {{ dom: any; }} c
                 */
                ...this.controls.reduce((a, c) => a.concat(" ", c.dom), [])
            );
        }
        /**
         * @param {{ tool?: string; color?: string; picture: Picture; done?: any[]; doneAt?: number; }} state
         */
    syncState(state) {
        this.state = state;
        this.canvas.syncState(state.picture);
        for (let ctrl of this.controls) ctrl.syncState(state);
    }
}

class ToolSelect {
    /**
     * @param {{ tool?: string; color?: string; picture: Picture; done?: any[]; doneAt?: number; }} state
     */
    constructor(state, { tools, dispatch }) {
        this.select = elt(
            "select", {
                onchange: () =>
                    dispatch({
                        tool: this.select.value
                    })
            },
            // @ts-ignore
            ...Object.keys(tools).map(name =>
                elt(
                    "option", { selected: name == state.tool }, name))
        );
        this.dom = elt("label", null, "Инструмент: ", this.select);
    }

    /**
     * @param {{ tool: any; }} state
     */
    syncState(state) {
        this.select.value = state.tool;
    }
}

class ColorSelect {
    /**
     * @param {{ tool?: string; color?: string; picture: Picture; done?: any[]; doneAt?: number; }} state
     */
    constructor(state, { dispatch }) {
            this.input = elt("input", {
                type: "color",
                value: state.color,
                onchange: () =>
                    dispatch({
                        // @ts-ignore
                        color: this.input.value
                    })
            });
            // @ts-ignore
            this.dom = elt("label", null, "Цвет: ", this.input);
        }
        /**
         * @param {{ color: any; }} state
         */
    syncState(state) {
        // @ts-ignore
        this.input.value = state.color;
    }
}

class ClearButton {
    /**
     * @param {{ picture: any; }} state
     */
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

    /**
     * @param {{ picture: any; }} state
     */
    syncState(state) {
        this.picture = state.picture;
    }
}

/**
 * @param {{ x: number; y: number; }} pos
 * @param {any} state
 * @param {(arg0: { picture: any; }) => void} dispatch
 */
function draw(pos, state, dispatch) {
    /**
     * @param {{ color: any; picture: { draw: (arg0: { x: any; y: any; color: any; }[]) => void; }; }} state
     * @param {{x:number, y:number}} point
     */
    function drawPixel(point, state) {
        let drawn = {
            x: point.x,
            y: point.y,
            color: state.color
        };
        dispatch({
            picture: state.picture.draw([drawn])
        });
    }
    drawPixel(pos, state);
    return drawPixel;
}

/**
 * @param {{ x: number; y: number; }} start
 * @param {{ color: any; picture: { draw: (arg0: { x: number; y: number; color: any; }[]) => void; }; }} state
 * @param {(arg0: { picture: any; }) => void} dispatch
 */
function rectangle(start, state, dispatch) {
    /**
     * @param {{ x: number; y: number; }} pos
     */
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


/**
 * @param {{ picture: { pixel: { (arg0: number, arg1: number): string}; width: number; height: number; draw: (arg0: { x: number; y: number; color: string; }[]) => void; }; color: string; }} state
 * @param {(arg0: { picture: any; }) => void} dispatch
 * @param {{ color: any; }[][] | { color: any; }[][]} pattern
 * @param {{x: number; y: number}} point
 */
function fill(point, state, dispatch, pattern) {
    let targetColor = state.picture.pixel(point.x, point.y);
    let isPatternFill;
    if (pattern) {
        isPatternFill = true;
    }

    let drawn = [{
        x: point.x,
        y: point.y,
        color: isPatternFill ? pattern[(point.y % pattern.length)][(point.x % pattern.length)].color : state.color
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

/**
 * @param {{ x: number; y: number; }} pos
 * @param {{ picture: { pixel: { (arg0: number, arg1: number): string}; 
 * width: number; height: number; 
 * draw: (arg0: { x: number; y: number; color: string; }[]) => void; }; 
 * color: string; }} state
 * @param {any} dispatch
 */
function fillWithPattern(pos, state, dispatch) {

    let targetColor = state.picture.pixel(pos.x, pos.y);

    let defaultFillPattern = [
        [{ color: targetColor }, { color: state.color }, { color: targetColor }],
        [{ color: state.color }, { color: targetColor }, { color: state.color }],
        [{ color: targetColor }, { color: state.color }, { color: targetColor }],
    ];

    fill({ x: pos.x, y: pos.y }, state, dispatch, defaultFillPattern);
}

/**
 * @param {{ x: any; y: any; }} pos
 * @param {{ picture: { pixel: (arg0: any, arg1: any) => void; }; }} state
 * @param {(arg0: { color: any; }) => void} dispatch
 */
function pick(pos, state, dispatch) {
    dispatch({
        color: state.picture.pixel(pos.x, pos.y)
    });
}

/**
 * @param {{ x: any; y: any; }} start
 * @param {{ color: any; picture: { draw: (arg0: { x: any; y: any; color: any; }[]) => void; }; }} state
 * @param {(arg0: { picture: any; }) => void} dispatch
 */
function line(start, state, dispatch) {

    /**
     * @param {{ x: number; y: number; }} pos
     */
    function drawLine(pos) {

        //Начальные точки на основе замыкания
        let x = start.x;
        let y = start.y;

        let x1 = pos.x;
        let y1 = pos.y;

        let drawn = [];

        let dx = x1 - x,
            dy = y1 - y;

        let stepY = sign(dy);
        let stepX = sign(dx);

        if (dx < 0) dx = -dx; //равносильно Math.abs(dy) > Math.abs(dx); =>
        if (dy < 0) dy = -dy; //поэтому  dx = |dx|; dy = |dy|


        //определяютя наклоном отрезка
        //прямая лежит ниже 45 градусов
        let pdX = stepX,
            pdY = 0,
            es = dy,
            m = dx;

        //Если выше 45 градусов
        if (dx <= dy) {
            pdX = 0;
            pdY = stepY;
            es = dx;
            m = dy;
        }

        let e = m / 2; // Такое определение предотвращает деление на 0 в случае вертикальной прямой

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

    /**
     * @param {number} x
     */
    function sign(x) {
        return (x > 0) ? 1 : (x < 0) ? -1 : 0;
    }

    drawLine(start);

    return drawLine;
}

function ellipse(start, state, dispatch) {


    function drawEllipse(pos) {

        let drawn = [];

        // Симметрия относительно 2-х главных осей
        function draw4Pixels({ x, y }) {
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
        }

        let stepY = -1;
        let stepX = 1;

        let x0 = start.x;
        let y0 = start.y;

        let a = Math.abs(pos.x - x0),
            b = Math.abs(pos.y - y0);

        let a2 = Math.pow(a, 2);
        let b2 = Math.pow(b, 2);

        let x = 0,
            y = b;

        let d = 4 * b2 * ((x + 1) * (x + 1)) +
            a2 * ((2 * y - 1) * (2 * y - 1)) -
            4 * a2 * b2; // Функция координат точки (x+1, y-1/2)

        //Выше 45 градусов
        while (a2 * (2 * y - 1) > 2 * b2 * (x + 1)) {
            draw4Pixels({ x, y });
            if (d < 0) {
                x += stepX;
                d += 4 * b2 * (2 * x + 3);
            } else {
                x += stepX;
                d -= 8 * a2 * (y - 1) - 4 * b2 * (2 * x + 3);
                y += stepY;
            }
        }

        d = b2 * ((2 * x + 1) * (2 * x + 1)) +
            4 * a2 * ((y + 1) * (y + 1)) -
            4 * a2 * b2; // Функция координат точки (x+1/2, y-1)

        while (y + 1 != 0) {
            draw4Pixels({ x, y });
            if (d < 0) {
                y += stepY;
                d += 4 * a2 * (2 * y + 3);
            } else {
                y += stepY;
                d -= 8 * b2 * (x + 1) - 4 * a2 * (2 * y + 3);
                x += stepX;
            }
        }

        dispatch({
            picture: state.picture.draw(drawn)
        });
    }
    drawEllipse(start);

    return drawEllipse;
}

/**
 * @param {{ x: any; y: any; }} start
 * @param {{ color: any; picture: { draw: (arg0: any[]) => void; }; }} state
 * @param {(arg0: { picture: any; }) => void} dispatch
 */
function circle(start, state, dispatch) {

    /**
     * @param {{ x: number; y: number; }} pos
     */
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
    /**
     * @param {{ picture: Picture; }} state
     */
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
                // @ts-ignore
                href: canvas.toDataURL(),
                download: "pixelart.png"
            });
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
        /**
         * @param {{ picture: any; }} state
         */
    syncState(state) {
        this.picture = state.picture;
    }
}

class LoadButton {
    /**
     * @param {any} _
     */
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

/**
 * @param {(any) => void} dispatch
 */
function startLoad(dispatch) {
    let input = elt("input", {
        type: "file",
        // @ts-ignore
        onchange: () => finishLoad(input.files[0], dispatch)
    });
    document.body.appendChild(input);
    input.click();
    input.remove();
}

/**
 * @param {*} file
 * @param {(any) => void} dispatch
 */
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
    reader.readAsDataURL(file);
}

const minWidth = 100;
const maxHeight = 100;

/**
 * @param {any} image
 */
function pictureFromImage(image) {
    let width = Math.min(minWidth, image.width);
    let height = Math.min(maxHeight, image.height);
    let canvas = elt("canvas", {
        width,
        height
    });
    // @ts-ignore
    let сx = canvas.getContext("2d");
    сx.drawImage(image, 0, 0);
    let pixels = [];
    let { data } = сx.getImageData(0, 0, width, height);

    for (let i = 0; i < data.length; i += 4) {
        let [r, g, b] = data.slice(i, i + 3);
        pixels.push("#" + hex(r) + hex(g) + hex(b));
    }
    return new Picture(width, height, pixels);

    /**
     * @param {{ toString: (arg0: number) => { padStart: (arg0: number, arg1: string) => string; }; }} n
     */
    function hex(n) {
        return n.toString(16).padStart(2, "0");
    }
}

/**
 * @param {*} state
 * @param {*} action
 */
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
    /**
     * @param {*} state
     */
    constructor(state, { dispatch }) {

            this.dom = elt("button", {
                onclick: () => dispatch({ undo: true }),
                disabled: state.done.length == 0
            }, " Отменить");
        }
        /**
         * @param {*} state
         */
    syncState(state) {
        // @ts-ignore
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

const baseTools = { draw, line, rectangle, circle, ellipse, fill, fillWithPattern, pick };

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
        /**
         * @param {{ tool?: string; color?: string; picture?: Picture}} action
         */
        dispatch(action) {
            state = historyUpdateState(state, action);
            app.syncState(state);
        }
    });
    return app.dom;
}