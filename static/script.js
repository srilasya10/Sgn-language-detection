const demosSection = document.getElementById("demos");
const enableWebcamButton = document.getElementById("webcamButton");
let webcamRunning = false;

const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const predictionElement = document.getElementById("prediction");
const countdownElement = document.createElement("p");
countdownElement.id = "countdown";
demosSection.appendChild(countdownElement);

let pred_array = [];
let countdown = 15;
let timer;

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
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
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
            drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });

            // Extract x and y coordinates
            const xCoords = landmarks.map(point => point.x);
            const yCoords = landmarks.map(point => point.y);

            // Find min x and y for normalization
            const minX = Math.min(...xCoords);
            const minY = Math.min(...yCoords);

            // Normalize the landmarks
            const normalizedLandmarks = landmarks.flatMap(({ x, y }) => [(x - minX), (y - minY)]);

            try {
                // Send normalized landmarks to backend for prediction only after countdown is 0
                if (countdown === 0) {
                    const response = await fetch('/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ landmarks: normalizedLandmarks })
                    });

                    // Get prediction from backend and display
                    const data = await response.json();
                    pred_array.push(data.prediction);
                    predictionElement.innerText = pred_array.join(' ') || "No prediction";

                    resetTimer(); // Reset the timer after a successful prediction
                }
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

function resetTimer() {
    countdown = 15; // Reset countdown to 15 seconds
}

function startTimer() {
    timer = setInterval(() => {
        countdown--;

        // Display the countdown in the last 5 seconds
        if (countdown <= 5) {
            countdownElement.innerText = `Next prediction in: ${countdown} seconds`;
        } else {
            countdownElement.innerText = ''; // Clear the countdown display when more than 5 seconds left
        }

        if (countdown === 0) {
            countdownElement.innerText = ''; // Clear countdown display
            // Do NOT reset the timer here; wait until a prediction is received
        }
    }, 1000); // Update every second
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
                startTimer(); // Start the prediction timer
            });
        });
    } else {
        webcamRunning = false;
        enableWebcamButton.querySelector('.mdc-button__label').innerText = "ENABLE WEBCAM";
        const stream = videoElement.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop()); // Stop the webcam
        videoElement.srcObject = null;
        clearInterval(timer); // Stop the timer
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
