
// import Swal from 'sweetalert2'


const demosSection = document.getElementById("demos");
const enableWebcamButton = document.getElementById("webcamButton");
const endButton = document.getElementById("endButton");
let webcamRunning = false;

const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const predictionElement = document.getElementById("prediction");
const countdownElement = document.createElement("p");
countdownElement.id = "countdown";
demosSection.appendChild(countdownElement);

let pred_array = [];
let countdown = 7;
let timer;
let lastPrediction = ''; // Variable to store the last prediction
let handDetected = false; // New flag to check if a hand is detected

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

Swal.fire({
    title: "Welcome to Sign Language Prediction",
    html: `
        <p>This app predicts sign language gestures using <strong>MediaPipe Hands</strong>.</p>
        <p>Please enable your webcam to start.</p>
        <p>The app will predict sign language gestures every <strong>7 seconds</strong>.</p>
        <p>Click <strong>'End'</strong> to finish and see your sentence.</p>
        <p>If no hand is detected, a <strong>space</strong> between words will be added.</p>
        <p>
            <a href="https://www.researchgate.net/figure/The-26-letters-and-10-digits-of-American-Sign-Language-ASL_fig1_328396430" 
               id="info" 
               style="color: #1E90FF; text-decoration: none;" 
               target="_blank">
               See Letters in Sign Language
            </a>
        </p>
    `,
    icon: "info",
    confirmButtonText: "OK",
    background: '#f0f8ff', // Light background color
    width: '600px', // Adjust the width as needed
    padding: '20px',
    customClass: {
        title: 'swal-title',
        content: 'swal-content',
        confirmButton: 'swal-confirm-button'
    }
});


async function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Check if hand landmarks are detected
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true; // Set handDetected to true when a hand is detected

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

            // If countdown is zero, make prediction
            if (countdown === 0) {
                try {
                    const response = await fetch('/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ landmarks: normalizedLandmarks })
                    });

                    // Get prediction from backend and display
                    const data = await response.json();
                    lastPrediction = data.prediction || ''; // Store the latest prediction

                    if (lastPrediction) {
                        pred_array.push(lastPrediction);
                        predictionElement.innerText = pred_array.join('') || "No prediction";
                    }
                    resetTimer(); // Reset the timer after a successful prediction
                } catch (error) {
                    console.error("Error during fetch:", error);
                    predictionElement.innerText = "Error in prediction";
                }
            }
        }
    } else {
        handDetected = false; // No hand detected
    }

    // If no hand is detected and countdown reaches 0, insert 'XXX' and reset the timer
    if (!handDetected && countdown === 0) {
        pred_array.push(' '); // Add 'XXX' to predictions array
        predictionElement.innerText = pred_array.join(''); // Update display with space
        resetTimer(); // Reset the timer
    }

    canvasCtx.restore();
}

function resetTimer() {
    countdown = 7; // Reset countdown to 7 seconds
    lastPrediction = ''; // Clear the last prediction
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

        // Check if countdown is zero
        if (countdown === 0 && !handDetected) {
            // If no hand detected, insert 'XXX' and reset the timer
            pred_array.push(' ');
            predictionElement.innerText = pred_array.join(''); // Update display
            resetTimer(); // Reset the timer
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

// Handle "End" button click: clear pred_array and display the sentence in an alert
endButton.addEventListener("click", () => {
    const sentence = pred_array.join('').trim(); // Join the predictions into a sentence
    if (sentence) {
        Swal.fire({
            title: "Your sentence is",
            text: sentence,
            icon: "success",
            confirmButtonText: "OK"
        }).then(() => {
            // Reset everything when "OK" is clicked
            resetApp();
        });
    }
});

// Function to reset the app
// Function to reset the app
function resetApp() {
    pred_array = []; // Clear the array
    predictionElement.innerText = "None"; // Reset the display

    // Disable webcam if running
    if (webcamRunning) {
        webcamRunning = false;
        enableWebcamButton.querySelector('.mdc-button__label').innerText = "ENABLE WEBCAM";
        const stream = videoElement.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop()); // Stop the webcam
        videoElement.srcObject = null; // Clear the video element source
        clearInterval(timer); // Stop the timer
    }

    // Reset countdown and clear the countdown display
    countdown = 7;
    countdownElement.innerText = '';

    // Hide the video element
    videoElement.style.display = 'none';

    // Change container color to blue
    demosSection.style.backgroundColor = 'blue'; // or any other color code you want

    // Optionally, reload the page to completely reset the state
    location.reload();
}


