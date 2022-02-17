// ===== INIT =======================================================
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let tolerance = 2;
let imageInput;
let toleranceInput;
let canvasHelp;
let imageWidth;
let imageHeight;
let outputCanvas;
let outputCtx;
let grid = [];
let paintedBorder = [];
let nextBlockId = 0;
let brush;
let brushData;
// ===== DOM CONTROL ================================================
window.addEventListener('load', () => __awaiter(this, void 0, void 0, function* () {
    // storing some references
    imageInput = document.querySelector('#source2d');
    toleranceInput = document.querySelector('#tolerance');
    outputCanvas = document.querySelector('#canvas2d');
    canvasHelp = document.querySelector('#content .help');
    outputCtx = outputCanvas.getContext('2d');
    // creating a brush for later
    brush = outputCtx.createImageData(1, 1);
    brushData = brush.data;
    // adding some listeners
    imageInput.addEventListener('change', onFileSelected);
    toleranceInput.addEventListener('change', onToleranceChanged);
    outputCanvas.addEventListener('click', onCanvasClick);
    // displaying first help message
    setCanvasHelp("Please select an image to use the tool.", true);
    // checking the localstorage, maybe we have some image stored?
    yield checkLocalStorage();
    // removing loading state
    document.querySelectorAll('.block').forEach(node => node.classList.remove('hidden'));
    document.querySelector('#loading').classList.add('hidden');
}));
const setCanvasHelp = (message, unsetCanvas = false) => {
    canvasHelp.innerHTML = message;
    if (!unsetCanvas)
        return;
    outputCanvas.width = 1;
    outputCanvas.height = 1;
    outputCtx.clearRect(0, 0, 1, 1);
};
// ===== FILE INPUT =================================================
// triggered when the user selects an image
const onFileSelected = () => __awaiter(this, void 0, void 0, function* () {
    // displaying user feedback
    setCanvasHelp("Loading selected image...", true);
    // we get the input file
    const file = imageInput.files[0];
    if (!file)
        return setCanvasHelp("Failed to open selected image.", true);
    // we get the file as a base64 string
    const base64 = yield getFileAsBase64(file);
    if (!base64)
        return setCanvasHelp("Failed to parse selected image.", true);
    ;
    // we save it on the localstorage (so if the user refreshs the page, the image is still there)
    saveBase64(base64);
    // and we create an image from the base54
    const image = yield createImageFromBase64(base64);
    setImageToCanvas(image);
});
// plots an image into the canvas and map its data
const setImageToCanvas = (image) => {
    setCanvasHelp("Parsing image...", true);
    // we can now update the canvas size to match the image
    imageWidth = outputCanvas.width = image.width;
    imageHeight = outputCanvas.height = image.height;
    // then we draw the image on the canvas
    outputCtx.drawImage(image, 0, 0, outputCanvas.width, outputCanvas.height);
    // resetting some image-related data
    grid = [];
    lastXY = null;
    paintedBorder = [];
    nextBlockId = 0;
    // and we finally iterate every pixel to store its information
    let id = 0;
    for (let x = 0; x < imageWidth; x++) {
        for (let y = 0; y < imageHeight; y++) {
            const rgb = getPixelColor(x, y);
            const colorId = getColorId(rgb);
            const p = { id, block: 0, x, y, rgb, color: colorId };
            grid.push(p);
            id++;
        }
    }
    setCanvasHelp("Click anywhere on the image to execute the magic wand on its pixel.");
};
const unsetCanvas = () => {
    outputCanvas.width = 1;
    outputCanvas.height = 1;
    outputCtx.clearRect(0, 0, 1, 1);
};
// gets the base64 of a file
const getFileAsBase64 = (file) => {
    return new Promise(resolve => {
        var fr = new FileReader();
        fr.onload = () => resolve(fr.result.toString());
        fr.readAsDataURL(file);
    });
};
// creates an image from a base64 string
const createImageFromBase64 = (base64) => {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = base64;
    });
};
// ===== TOLERANCE  =================================================
const onToleranceChanged = () => {
    // getting the input value
    const value = toleranceInput.value;
    setTolerance(parseFloat(value), true);
};
const setTolerance = (value, fromEvent = false) => {
    // actually updating the value used by the wand
    tolerance = value;
    if (fromEvent) {
        saveTolerance(value);
    }
    else {
        toleranceInput.value = value.toFixed();
    }
    // if there is an xy set, let's live-update the result
    if (lastXY)
        execMagicWand(lastXY.x, lastXY.y);
    // updating the label display
    document.querySelector("span.tolerance").innerHTML = value.toString();
};
// triggered when the user clicks anywhere on the canvas
const onCanvasClick = (ev) => __awaiter(this, void 0, void 0, function* () {
    // gets the click coords on the canvas object
    const { offsetX, offsetY } = ev;
    // execute the magic wand on it
    execMagicWand(offsetX, offsetY);
});
let lastXY;
const execMagicWand = (x, y) => {
    // 'unpaiting' any border alreday painted
    paintedBorder.forEach(id => paintPoint(id));
    // storing the xy so we can use it again if the user changes the tolerance
    lastXY = { x, y };
    // get the position id for this xy
    const id = getId(x, y);
    // get info about the pixel
    const p1 = grid[id];
    // if this pixel is not in a block yet, let's get it
    const { border } = getAreaAroundPixel(p1);
    paintedBorder = border;
    // if the pixel (now) has a block, let's show the selection!
    border.forEach(id => paintBorder(id));
};
// adders to get coords around one x/y
const adders = [
    [0, -1],
    [0, +1],
    [-1, 0],
    [+1, 0]
];
// flags the whole grid based on the clicked pixel and the selected tolerance, the get the affected area and its border
const getAreaAroundPixel = (clicked, extra = false) => {
    console.log('getBlockPixel()');
    // create a map to mark every pixel with the answer "does this color is within tolerance-distance of thec clicked point?""
    const map = [];
    // for every pixel
    for (const p1 of grid) {
        // we get its position
        const { x, y } = p1;
        // and the delta color between the clicked pixel and it
        const delta = getColorDelta(clicked, p1);
        // if there is no map for its line yet, create one
        if (!map[y])
            map[y] = [];
        // then map its pixel flag
        map[y][x] = delta <= tolerance ? 1 : 0;
    }
    // increasing the blocker count	and setting it for the clicked pixel
    clicked.block = ++nextBlockId;
    // creating a control stack so we can keep expanding and processing pixels
    const stack = [clicked.id];
    // while also storing all the pixels inside its area
    const area = [clicked.id];
    // and the 'border' pixels so we can atually show the selection
    const border = [];
    // while there are pixels to process
    while (stack.length) {
        // get the first on the list
        const id1 = stack.shift();
        // get the grid entry for it
        const p1 = grid[id1];
        // get its coords
        const { x, y } = p1;
        // run the adders to iterate around the pixel
        for (const add of adders) {
            // get the neighbor coords
            const x2 = x + add[0];
            const y2 = y + add[1];
            // get its id
            const id2 = getId(x2, y2);
            // if there is no such id (this means it's outside of the canvas), we skip the add
            if (id2 < 0)
                continue;
            // otherwise, we get the flag for it
            const flag = map[y2][x2];
            if (flag > 0) {
                // if it's marked as tolerated, let's unset it so it won't be processed again
                map[y2][x2] = -1;
                // then we add it to the stack, so we can process around it as well
                stack.push(id2);
                area.push(id2);
                // marking the neighbor with the same block value
                grid[id2].block = clicked.block;
            }
            if (flag == 0) {
                border.push(id2);
                map[y2][x2] = -1;
            }
        }
    }
    return { area, border };
};
// chache object so we can store delta values between colors, so we don't need to calculate it again
let colorCache = {};
// returns the delta difference between two points on the canvas
const getColorDelta = (p1, p2) => {
    // if their color is the same, the delta is of course zero
    if (p1.color == p2.color)
        return 0;
    // creating a mash string so we can check its cache
    const mash = p1.color + '.' + p2.color;
    const cached = colorCache[mash];
    // if there is a cache, return it
    if (cached != undefined)
        return cached;
    // if there is not, actually calculate the differnce
    const delta = deltaE(p1.rgb, p2.rgb);
    // cache it
    colorCache[mash] = delta;
    // then return!
    return delta;
};
// gets a xy value as an intenger
const getId = (x, y) => {
    if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight)
        return -1;
    return x * imageHeight + y;
};
// gets an rbg value as an integer
const getColorId = (rgb) => {
    const [r, g, b] = rgb;
    return 65536 * r + 256 * g + b;
};
// gets the rgb value of a canvas xy position
const getPixelColor = (x, y) => {
    const [r, g, b] = outputCtx.getImageData(x, y, 1, 1).data;
    return [r, g, b];
};
// ===== CANVAS PAINTING ============================================
// paints a red pixel based on a pixel xy position
const paintBorder = (id) => {
    const p = grid[id];
    if (p)
        paintPixel(p.x, p.y, [255, 0, 0]);
};
// paints the actual pixel back to its xy position
const paintPoint = (id) => {
    const p = grid[id];
    paintPixel(p.x, p.y, p.rgb);
};
// paints a color on a xy position
const paintPixel = (x, y, rgb) => {
    const [r, g, b] = rgb;
    brushData[0] = r;
    brushData[1] = g;
    brushData[2] = b;
    brushData[3] = 255;
    outputCtx.putImageData(brush, x, y);
};
// ===== LOCAL STORAGE ==============================================
const lsbase64 = 'image@base64';
const lstolerance = 'image@tolerance';
const saveBase64 = (base64) => {
    // storing our base64 image on the localStorage (super big images could be a problem, tho)
    try {
        localStorage.setItem(lsbase64, base64);
    }
    catch (e) {
        // I knew it...
    }
};
const saveTolerance = (value) => {
    console.log('saveTolerance', value);
    localStorage.setItem(lstolerance, value.toString());
};
const checkLocalStorage = () => __awaiter(this, void 0, void 0, function* () {
    // checking if we have a tolerance stored
    const tol = localStorage.getItem(lstolerance);
    const value = (tol !== undefined && tol !== null) ? parseFloat(tol) : tolerance;
    setTolerance(value);
    // checking if we have an image stored
    const base64 = localStorage.getItem(lsbase64);
    if (base64) {
        // if we do, plot it into the canvas
        const image = yield createImageFromBase64(base64);
        setImageToCanvas(image);
    }
});
// ===== HELPERS ====================================================
// shortcut for querySelector
const $ = (selector) => {
    return document.querySelector(selector);
};
// rgb color comparation function (from: https://github.com/antimatter15/rgb-lab)
function deltaE(rgbA, rgbB) {
    let labA = rgb2lab(rgbA);
    let labB = rgb2lab(rgbB);
    let deltaL = labA[0] - labB[0];
    let deltaA = labA[1] - labB[1];
    let deltaB = labA[2] - labB[2];
    let c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
    let c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
    let deltaC = c1 - c2;
    let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
    deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
    let sc = 1.0 + 0.045 * c1;
    let sh = 1.0 + 0.015 * c1;
    let deltaLKlsl = deltaL / (1.0);
    let deltaCkcsc = deltaC / (sc);
    let deltaHkhsh = deltaH / (sh);
    let i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
    return i < 0 ? 0 : Math.sqrt(i);
}
function rgb2lab(rgb) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, x, y, z;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}
