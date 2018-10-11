import * as admin from 'firebase-admin';

export class Freightages {
    
    static bucketPath: string = "/bucket/freightagesList/";
    static basePath: string = `${Freightages.bucketPath}freightages/`;

    static getRef = (id) =>{
        return `${Freightages.basePath}${id}`
    }

    static getDocByRef = async (ref)=>{
        return admin.firestore().doc(ref).get()
    }
    static getDoc = async (id)=>{
        return admin.firestore().doc(Freightages.getRef(id)).get()
    }

    
    static isValidFreightage= async (freightage) =>{
        return true
    }

}