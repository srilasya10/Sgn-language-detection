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
    maxNumHands: 1, // Process up to 1 hand
    modelComplexity: 1, // Adjust based on performance requirements
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

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

            // Extract x and y coordinates
            const xCoords = landmarks.map(point => point.x);
            const yCoords = landmarks.map(point => point.y);

            // Find min x and y for normalization
            const minX = Math.min(...xCoords);
            const minY = Math.min(...yCoords);

            // Preprocess the landmarks: Normalize by subtracting min values
            const normalizedLandmarks = landmarks.flatMap(({ x, y }) => [(x - minX), (y - minY)]);

            try {
                // Send normalized landmarks to the backend for real-time prediction
                const response = await fetch('/predict', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ landmarks: normalizedLandmarks })
                });

                // Get prediction from backend and display
                const data = await response.json();
                predictionElement.innerText = data.prediction || "No prediction";

            } catch (error) {
                console.error("Error during fetch:", error);
                predictionElement.innerText = "Error in prediction";
            }
        }
    } else {
        predictionElement.innerText = "No hand detected";
    }

    canvasCtx.restore();
}

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
