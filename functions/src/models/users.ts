import * as admin from 'firebase-admin';

export class Users {
    
    static basePath: string = "/bucket/usersList/users/";


    static getRef = (uid) =>{
        return `${Users.basePath}${uid}`
    }

    static getDoc = async (uid)=>{
        return admin.firestore().doc(Users.getRef(uid)).get()
    }
}