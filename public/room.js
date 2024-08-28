function load() {
    var elems = document.querySelectorAll('.modal');
    var instances = M.Modal.init(elems);
}

load();

document.getElementById('clear').addEventListener('click', ()=>{
    document.getElementById('search').value = '';
})
  
document.getElementById('search').addEventListener('input', async()=>{
    const items = document.getElementById('item-list');
    items.innerHTML='';
    const query=document.getElementById('search').value;
    if(query.length<2) return;
    const data = await fetchData('/api/search',{query: query});
    Array.from(data.querynames).forEach((user)=>{
        const list = document.createElement('div');
        list.textContent = user.name;
        list.className = 'list-box';
        items.appendChild(list);
    })
})
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  