const demosSection = document.getElementById("demos");
const enableWebcamButton = document.getElementById("webcamButton");
let webcamRunning = false;

const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const predictionElement = document.getElementById("prediction");

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1, // Process up to 2 hands
    modelComplexity: 1, // Adjust this based on performance requirements
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Called whenever landmarks are detected
hands.onResults(onResults);

async function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            // Draw hand landmarks on canvas for visualization
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 5
            });
            drawLandmarks(canvasCtx, landmarks, {
                color: "#FF0000",
                lineWidth: 2
            });

            // Normalize landmarks: scale coordinates between 0 and 1
            // const normalizedLandmarks = landmarks.map(({ x, y }) => ({
            //     x: x / videoElement.videoWidth,
            //     y: y / videoElement.videoHeight
            // }));

            // Flatten normalized landmarks into an array of x, y values
            // const xyLandmarks = normalizedLandmarks.flatMap(({ x, y }) => [x, y]);
            const xyLandmarks = landmarks.flatMap(({ x, y }) => [x, y]);

            // Send normalized landmarks to the backend for real-time prediction
            const response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ landmarks: xyLandmarks })
            });

            // Get prediction from backend and display
            const prediction = await response.json();
            predictionElement.innerText = prediction.prediction || "No prediction";
        }
    } else {
        predictionElement.innerText = "No hand detected"; // Handle case with no hand detection
    }

    canvasCtx.restore();
}

// Check if browser supports webcam access
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
}

function enableCam() {
    if (!webcamRunning) {
        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
            videoElement.srcObject = stream;
            videoElement.addEventListener("loadeddata", () => {
                webcamRunning = true;
                enableWebcamButton.querySelector('.mdc-button__label').innerText = "DISABLE WEBCAM";
                startDetection();
            });
        });
    } else {
        webcamRunning = false;
        enableWebcamButton.querySelector('.mdc-button__label').innerText = "ENABLE WEBCAM";
        const stream = videoElement.srcObject;
        const tracks = stream.getTracks();

        tracks.forEach((track) => track.stop()); // Stop the webcam

        videoElement.srcObject = null;
    }
}

// Start processing video frames
function startDetection() {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    async function processVideoFrame() {
        if (webcamRunning) {
            await hands.send({ image: videoElement });
            requestAnimationFrame(processVideoFrame); // Continue processing frames
        }
    }

    processVideoFrame();
}
