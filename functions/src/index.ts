import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const path = require('path')
const os = require('os');
const fs = require('fs');
const FieldValue = require('firebase-admin').firestore.FieldValue;
//inititalize firebase admin
admin.initializeApp(functions.config().firebase);

// trigger when user singup complete
export const onSignUpComplete = 
    functions.database.ref('/intent/sign_up/{auuid}/finish')
        .onCreate(async (snapshot,context)=>{
            if(!snapshot.val())
                return false
            const auuid = context.params.auuid
            //create news users into firestore and link it with realtime database
            const userDataSnapshot = await admin.database().ref(`/intent/sign_up/${auuid}`).once('value')
            //move images to correct bucket
            const promises = []
            const nic_front_path = userDataSnapshot.val().NIC_FRONT_JPG.path
            const nic_back_path = userDataSnapshot.val().NIC_BACK_JPG.path
            const profile_path = userDataSnapshot.val().PROFILE_JPG.path
            const NIC_FRONT_JPG_PATH = `/users/nic/${auuid}/${nic_front_path.split("/").pop()}`
            const NIC_BACK_JPG_JPG_PATH = `/users/nic/${auuid}/${nic_back_path.split("/").pop()}`
            const PROFILE_JPG_JPG_PATH = `/users/nic/${auuid}/${profile_path.split("/").pop()}`
            promises.push(moveFileFromTo(nic_front_path,NIC_FRONT_JPG_PATH))
            promises.push(moveFileFromTo(nic_back_path,NIC_BACK_JPG_JPG_PATH))
            promises.push(moveFileFromTo(profile_path,PROFILE_JPG_JPG_PATH))
            await Promise.all(promises)
            //create new user doc to store into firestore
            var userDoc = {
                name: userDataSnapshot.val().user_info.fullName,
                firstname: userDataSnapshot.val().user_info.firstName,
                nicNumber: userDataSnapshot.val().user_info.nic_number,
                nicFrontUrl: admin.storage().bucket().file(NIC_FRONT_JPG_PATH).metadata.name,
                nicBackUrl: admin.storage().bucket().file(NIC_BACK_JPG_JPG_PATH).metadata.name,
                avatarUrl: admin.storage().bucket().file(PROFILE_JPG_JPG_PATH).metadata.name,
                public: true,
                timestamp: FieldValue.serverTimestamp()
            }
            let userRef = await admin.firestore().collection("/users").add(userDoc)
            await admin.database().ref(`/users/${auuid}`).set(userRef.id)
            return admin.database().ref(`/intent/sign_up/${auuid}`).remove()
        });

const moveFileFromTo = async (from,to) => {
    // Download file from bucket.
    const fileName = from.split("/").pop()
    const bucket = admin.storage().bucket();
    const tempFilePath = path.join(os.tmpdir(), fileName);
    bucket.file(from).metadata.name
    return bucket.file(from).download({
        destination: tempFilePath,
    }).then(() => {
        console.log('Image download to: ', tempFilePath);
        return bucket.upload(tempFilePath, {
            destination: to,
            metadata: fileName,
        });
    }).then(() => {
        fs.unlinkSync(tempFilePath)
        return bucket.file(from).delete()
    });
}