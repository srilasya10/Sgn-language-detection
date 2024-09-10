from flask import Flask, request, jsonify, render_template
import pickle
import numpy as np
import os


app = Flask(__name__, template_folder='frontend')  # Set the custom template folder

# Load the pickled model
model_dict = pickle.load(open('model.p', 'rb'))
model = model_dict['model']

# Dictionary for label encoding
labels_dict = {
    0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J',
    10: 'K', 11: 'L', 12: 'M', 13: 'N', 14: 'O', 15: 'P', 16: 'Q', 17: 'R', 18: 'S',
    19: 'T', 20: 'U', 21: 'V', 22: 'W', 23: 'X', 24: 'Y', 25: 'Z', 26: '0', 27: '1',
    28: '2', 29: '3', 30: '4', 31: '5', 32: '6', 33: '7', 34: '8', 35: '9'
}

@app.route('/')
def home():
    return render_template('index.html')  # Serve the HTML template

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json.get('landmarks', [])

    if not data:
        return jsonify({'error': 'No landmarks data provided'}), 400

    try:
        # Reshape the data to match the model's expected input of 42 features
        data = np.asarray(data).reshape(1, -1)

        # Log the incoming data for debugging
        # print("Incoming data shape:", data.shape)
        print("Incoming data:", data)

        prediction = model.predict(data)

        # Log the prediction result for debugging
        print("Model prediction:", prediction)

        predicted_character = labels_dict[int(prediction[0])]
        print("Predicted character:", predicted_character)
        return jsonify({'prediction': predicted_character})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
