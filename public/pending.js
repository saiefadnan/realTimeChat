export function Pending(recipient, content, offset){
    const pending=window.pending;
    pending.status = true;
    pending.recipient = recipient;
    pending.content = content;
    pending.offset = offset; 
}

export function clearPending(){
    const pending=window.pending;
    pending.status = false;
    pending.recipient = null;
    pending.content = null;
    pending.offset = null; 
}