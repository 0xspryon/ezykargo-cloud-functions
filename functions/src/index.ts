import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {Auth} from "./intent";
//inititalize firebase admin
admin.initializeApp(functions.config().firebase);

// trigger when user singup complete
export const onSignUpComplete = 
    functions.database.ref('/intents/sign_up/{auuid}/finished')
        .onUpdate(async (snapshot,context)=>{
            return Auth.signUp(snapshot,context)
        });