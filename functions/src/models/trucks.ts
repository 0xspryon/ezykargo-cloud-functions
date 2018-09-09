import * as admin from 'firebase-admin';

export class Trucks {
    
    static bucketPath: string = "/bucket/trucksList/";
    static basePath: string = `${Trucks.bucketPath}trucks/`;

    static getRef = (id) =>{
        return `${Trucks.basePath}${id}`
    }

    static getDoc = async (id)=>{
        return admin.firestore().doc(Trucks.getRef(id)).get()
    }

    static isValidTruck= (truck) =>{
        return true
    }

    static isValidTechnicalVisit= (tv) =>{
        return true
    }

    static isValidInsurrance= (insurrance) =>{
        return true
    }
}