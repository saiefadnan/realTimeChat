function cleanUp(existingScript){
    //console.log(window.eventListeners.length);
    existingScript.remove();
    window.eventListeners.forEach(({element, event, handler}) => {
        element.removeEventListener(event,handler);
    });
    window.eventListeners.length = 0;
    const page = document.getElementById('page');
    if(page){
        while(page.firstChild){
            page.removeChild(page.firstChild);
        }
    }
    //('clean....');
}
export default function loadPage(content){
    fetch(content)
    .then(response=>{
        if(!response.ok){
            throw new Error('Network status not good',response.statusText);
        }
        return response.text();
    })
    .then(data=>{
            const script = document.createElement('script');
            const Script = content.replace('.html','.js');
            const existingScript = document.querySelector(`script[src="${Script}"]`);
            if(existingScript){
                cleanUp(existingScript);
            }
            document.getElementById('page').innerHTML=data;
            script.src = `${Script}`;
            script.onload = () => {
                //console.log('Script loaded successfully');
            };
            script.onerror = (error) => {
                console.error('Error loading script', error);
            };
            document.body.appendChild(script);
    })
    .catch(error=>{
        console.error('Content fetched failed',error);
    })
}