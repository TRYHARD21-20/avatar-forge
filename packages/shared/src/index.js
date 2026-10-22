import {z} from 'zod';
export * from './capture.js';export * from './quiz.js';export * from './scenes.js';
export const safeText=(s,max=42)=>String(s||'').replace(/[<>\\\u0000-\u001f]/g,'').trim().slice(0,max);
export const safeName=(s)=>safeText(s,28).replace(/\b(fuck|nazi|slur)\b/gi,'***');
export const RoomCreate=z.object({mode:z.enum(['duo','squad']),name:z.string().min(1).max(28),consent:z.boolean().refine(v=>v===true),photoConsent:z.boolean().default(false),track:z.string().max(40).optional()}).strict();
export const RoomJoin=z.object({name:z.string().min(1).max(28),consent:z.literal(true),photoConsent:z.boolean().default(false)}).strict();
export const WsMessage=z.discriminatedUnion('type',[
 z.object({type:z.literal('hello'),room:z.string().min(6).max(16),token:z.string().min(12).max(2000)}).strict(),
 z.object({type:z.literal('ready'),value:z.boolean()}).strict(),
 z.object({type:z.literal('answer'),question:z.number().int().min(0).max(30),answer:z.enum(['LEFT','RIGHT']),verified:z.boolean()}).strict(),
 z.object({type:z.literal('pose'),yaw:z.number().finite().min(-90).max(90),progress:z.number().min(0).max(1)}).strict(),
 z.object({type:z.literal('vote'),round:z.number().int().min(0).max(25),forId:z.string().max(80)}).strict(),
 z.object({type:z.literal('poll'),question:z.string().min(2).max(80)}).strict(),
 z.object({type:z.literal('report'),reason:z.string().min(2).max(120)}).strict(),
 z.object({type:z.literal('advance')}).strict(),
 z.object({type:z.literal('leave')}).strict()
]);
export const ConsentPost=z.object({scope:z.array(z.enum(['device_game','research','group_photo'])).min(1).max(3),timestamp:z.string().datetime(),hash:z.string().regex(/^[0-9a-f]{64}$/),envelope:z.object({iv:z.string().max(40),wrappedKey:z.string().max(1000),ciphertext:z.string().min(20).max(5_000_000)}).strict()}).strict();
export const WithdrawPost=z.object({receiptId:z.string().uuid()}).strict();
