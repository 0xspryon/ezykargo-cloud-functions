import * as admin from 'firebase-admin';

export class Users {
    
    static basePath: string = "/bucket/usersList/users/";


    static getRef = (uid) =>{
        return `${Users.basePath}${uid}`
    }

    static getDoc = async (uid)=>{
        return admin.firestore().doc(Users.getRef(uid)).get()
    }

    static refExsits = async (userRef) =>{
        const dataSnapshot = await admin.firestore().doc(userRef).get()
        const result = dataSnapshot.exists;
        return result;
    }
}