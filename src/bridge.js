import OBR from '@owlbear-rodeo/sdk';
import {ID} from './core.js';
export async function bridge(){return new BroadcastChannel(ID+'/'+await OBR.player.getConnectionId());}
export const absolute=(file)=>new URL(file,location.href).href;
