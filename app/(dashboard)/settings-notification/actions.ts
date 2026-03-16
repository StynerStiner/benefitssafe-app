'use server'

export async function handleFirebaseSettings(formData: FormData) {
    firebaseSecretKey: formData.get('firebaseSecretKey');
    firebasePublicVapidKey: formData.get('firebasePublicVapidKey');
    firebaseAPIKey: formData.get('firebaseAPIKey');
    firebaseAuthDomain: formData.get('firebaseAuthDomain');
    firebaseProjectID: formData.get('firebaseProjectID');
    firebaseStorageBucket: formData.get('firebaseStorageBucket');
    firebaseMessageSenderID: formData.get('firebaseMessageSenderID');
    firebaseAppID: formData.get('firebaseAppID');
    firebaseMeasurementID: formData.get('firebaseMeasurementID');
}
