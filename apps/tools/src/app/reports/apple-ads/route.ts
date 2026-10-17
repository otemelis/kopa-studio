import {requireOwner} from '@/lib/auth';
import {directView} from './view.generated';
export const dynamic='force-dynamic';
export async function GET(){
 await requireOwner();
 return new Response(directView.html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':directView.csp,'Referrer-Policy':'no-referrer'}});
}
