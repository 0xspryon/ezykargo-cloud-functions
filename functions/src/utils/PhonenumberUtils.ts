export class PhonenumberUtils {
    static getMomoProviderFromNumber = number => {
        let index = -1;
        const MTN = 7;
        const ORANGE = 9;
        const NEXTTEL = 6;
        const MTN_ORANGE = 5;
        const ORANGE_3 = 655;
        const two_character_prefix = `${number}`.substr(0,2)
        if(two_character_prefix.indexOf(`${MTN}`) !== -1) return 'momo';
        if(two_character_prefix.indexOf(`${ORANGE}`) !== -1) return 'om';
        if(two_character_prefix.indexOf(`${MTN_ORANGE}`) !== -1) {
            const three_character_prefix = `${number}`.substr(0,3)
            if(+three_character_prefix < +ORANGE_3 ) return 'momo'
            else return 'om'
        }
        if(two_character_prefix.indexOf(`${NEXTTEL}`) !== -1) return 'nexttel';
        return null;
    }


}