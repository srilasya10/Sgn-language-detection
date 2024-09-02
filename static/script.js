// Ensure TensorFlow.js and Handpose model are loaded
if (typeof tf === 'undefined' || typeof handpose === 'undefined') {
    alert('TensorFlow.js or Handpose model is not loaded. Please check the library scripts.');
} else {
    const startBtn = document.getElementById('start-btn');
    const videoElement = document.getElementById('video');
    const predictedCharacterElement = document.getElementById('predicted-character');

    let modelLoaded = false;
    let handposeModel;
    
    // Initialize TensorFlow.js Handpose model and camera
    async function setup() {
        handposeModel = await handpose.load();
        modelLoaded = true;

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        videoElement.play();

        videoElement.addEventListener('loadeddata', () => {
            detectHands();
        });
    }

    async function onResults(predictions) {
        if (predictions.length > 0) {
            const landmarks = predictions[0].landmarks;
            const x = landmarks.map(landmark => landmark[0]);
            const y = landmarks.map(landmark => landmark[1]);

            const minX = Math.min(...x);
            const minY = Math.min(...y);

            const normalizedLandmarks = landmarks.flatMap(landmark => [landmark[0] - minX, landmark[1] - minY]);

            if (normalizedLandmarks.length === 42) {
                try {
                    const response = await fetch('/predict', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ landmarks: normalizedLandmarks })
                    });

                    const data = await response.json();
                    if (data.error) {
                        throw new Error(data.error);
                    }

                    predictedCharacterElement.textContent = data.prediction;
                } catch (error) {
                    console.error('Error fetching prediction:', error);
                    predictedCharacterElement.textContent = 'Error';
                }
            } else {
                console.error('Unexpected number of features:', normalizedLandmarks.length);
            }
        }
    }

    async function detectHands() {
        if (modelLoaded) {
            const predictions = await handposeModel.estimateHands(videoElement, { flipHorizontal: true });
            onResults(predictions);
            requestAnimationFrame(detectHands);
        }
    }

    startBtn.addEventListener('click', async () => {
        if (!modelLoaded) {
            await setup();
        }
    });
}


// Draw the landmarks on the video feed for debugging
function drawLandmarks(predictions) {
    const ctx = videoElement.getContext('2d');
    ctx.clearRect(0, 0, videoElement.width, videoElement.height);

    predictions.forEach(prediction => {
        const landmarks = prediction.landmarks;

        for (let i = 0; i < landmarks.length; i++) {
            const x = landmarks[i][0];
            const y = landmarks[i][1];

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "red";
            ctx.fill();
        }
    });
}
