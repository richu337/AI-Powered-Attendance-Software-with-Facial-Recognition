import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let modelsLoaded = false;

export const loadModels = async () => {
    if (modelsLoaded) return;
    
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
        console.log('Face-api models loaded successfully');
    } catch (error) {
        console.error('Error loading face-api models:', error);
        throw error;
    }
};

export const getFaceEmbedding = async (imageSrc: string): Promise<Float32Array | null> => {
    await loadModels();
    
    const img = await faceapi.fetchImage(imageSrc);
    const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
        
    return detection ? detection.descriptor : null;
};

export const compareEmbeddings = (embedding1: Float32Array, embedding2: Float32Array): number => {
    return faceapi.euclideanDistance(embedding1, embedding2);
};
