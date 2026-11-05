import re
t='C:/repos/KARTODROMO/.tmp-200/'
p=t+'site-politica.js'
j=open(p,encoding='utf8',newline='').read()
def tr(a,c):
    global j
    assert a in j,a[:60]
    j=j.replace(a,c,1)
tr('bc.hasChildNodes()?xp.hydrateRoot(bc,qp):xp.createRoot(bc).render(qp);','bc.textContent="";xp.createRoot(bc).render(qp);')
tr('`race-row ${c.past?"past":""}`','`race-row ${c.past&&c.id!=="500-milhas"?"past":""}`')
# encerrada vai para o fim da lista
i=j.index('{id:"100-milhas-light"'); f=j.index(',{id:"200-milhas"',i)
ent=j[i:f]; j=j[:i]+j[f+1:]
fim=j.index('}];function pv')
j=j[:fim+1]+','+ent+j[fim+1:]
open(p,'w',encoding='utf8',newline='').write(j)
w='C:/repos/KARTODROMO/workers/campeonato-200/'
s=open(w+'wrangler.jsonc',encoding='utf8').read()
if '500-milhas-logo' not in s:
    s=s.replace('"routes": [','"routes": [\n    { "pattern": "kartodromodebetim.com.br/media/championships/500-milhas-logo.png", "zone_name": "kartodromodebetim.com.br" },\n    { "pattern": "www.kartodromodebetim.com.br/media/championships/500-milhas-logo.png", "zone_name": "kartodromodebetim.com.br" },')
    open(w+'wrangler.jsonc','w',encoding='utf8').write(s)
c=open(w+'public/200-milhas/style.css',encoding='utf8').read()
if 'footer a' not in c:
    c+='\nfooter a{display:inline-block;padding:11px 4px}\n'
    open(w+'public/200-milhas/style.css','w',encoding='utf8',newline='').write(c)
h=open(w+'public/200-milhas/index.html',encoding='utf8').read().replace('style.css?v=20261031d','style.css?v=20261031e')
open(w+'public/200-milhas/index.html','w',encoding='utf8',newline='').write(h)
