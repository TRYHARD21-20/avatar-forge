declare module '@avatar/shared' {
  export const SCENES: string[][];
  export const SOLO_QUESTIONS: {question:string;left:string;right:string}[];
  export const DUO_QUESTIONS: {question:string;left:string;right:string}[];
  export const POLLS: string[];
  export const STORE_ITEMS: [string,number,string][];
  export const EXPORT_PRESETS: [string,number,number][];
  export const sceneDataURI: (id:string)=>string;
  export const sceneSVG: (id:string,width?:number,height?:number)=>string;
  export const entertainmentScore: (seed:string,max?:number)=>number;
  export const matchScore: (a:string[],b:string[])=>number;
  export const randomizedChallenges: (random?:()=>number)=>string[];
  export const poseFromMatrix:(data:number[])=>{yaw:number;pitch:number;roll:number;source:string}|null;
  export const poseFromLandmarks:(data:any[])=>{yaw:number;pitch:number;roll:number;source:string}|null;
  export const qualityGate:(obs:any)=>string|null;
  export const DEFAULTS: Readonly<{frontYaw:number;frontPitch:number;sideYaw:number;easySideYaw:number;holdMs:number;easyHoldMs:number;selectHoldMs:number;easySelectHoldMs:number;sideHysteresis:number}>;
  export class CaptureMachine {constructor(options?:{target?:string;easy?:boolean;select?:boolean;mirror?:boolean});step(observation:any,at?:number):{captured:boolean;progress:number;hint:string;quality:number|null;yaw:number;state:string};reset():void;}
}
