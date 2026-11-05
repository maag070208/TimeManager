// Sprite de Langostin (32x32 px). Animaciones: idle, wave, work, ok, err, think, point, help, info, success, warn, search, sleep, love, idea, loading, empty, notify, offline, lock, 404, upload, assigned, fixing, urgent, resolved, coffee, thanks, dance, birthday, eat, beach, christmas, halloween, key, bell

var C={o:'#3A2018',b:'#C95B3E',d:'#A8442B',l:'#E58B6B',w:'#FFFFFF',g:'#E2B65C',y:'#EBC770',h:'#D0A044',u:'#0F5C80',k:'#F08A6E',s:'#7FD0EB',r:'#E0342F',n:'#3FAE5A',q:'#F2C230',m:'#7A4A2A',a:'#9AA5AD',v:'#7B4FA0',e:'#F28C28'};
function build(a,f){
var G=[],i,j;for(j=0;j<32;j++)G.push(new Array(32).fill(null));
var oy=2,ox=0,P=function(x,y,c){y+=oy;x+=ox;if(x>=0&&x<32&&y>=0&&y<32)G[y][x]=c?C[c]:null},
R=function(x,y,w,h,c){for(var q=0;q<h;q++)for(var p=0;p<w;p++)P(x+p,y+q,c)},
Q=function(x,y,c){if(x>=0&&x<32&&y>=0&&y<32)G[y][x]=C[c]},
arm=function(x0,y0,x1,y1){var n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;for(var t=0;t<=n;t++)R(Math.round(x0+(x1-x0)*t/n),Math.round(y0+(y1-y0)*t/n),2,2,'b')},
claw=function(x,y,open){R(x,y,2,3,'b');R(x+3,y,2,3,'b');if(!open)R(x+2,y,1,3,'d');R(x,y+3,5,2,'b');R(x,y+4,5,1,'d')};
var GL=function(x,y,rows,raw){rows.forEach(function(r,j){for(var i=0;i<r.length;i++){var c=r[i];if(c!='.')(raw?Q:P)(x+i,y+j,c)}})};
var D=function(x,y,c){Q(x,y,c);Q(x+1,y,c);Q(x,y+1,c);Q(x+1,y+1,c)},S=function(x,y,c){Q(x,y,c);Q(x-1,y,c);Q(x+1,y,c);Q(x,y-1,c);Q(x,y+1,c)};
var hat=0,bob=(f>>2)&1,blink=(f%18)<2,alt=(f>>1)&1,face='n',lx=2,ly=14,lo=0,rx=25,ry=14,ro=0,wr=1,spark=0;
if(a=='idle'){oy+=bob}
if(a=='wave'){oy+=bob;lx=2+alt;ly=5;lo=alt}
if(a=='work'){ry=(f%4<2)?12:16;spark=f%4>=2;oy+=0}
if(a=='ok'){oy+=((f>>1)&1)?-2:0;wr=0;lx=2;ly=5;rx=25;ry=5;lo=ro=alt;face='h'}
if(a=='err'){wr=0;ly=15;ry=15;face='s'}
if(a=='think'){oy+=bob;rx=24;ry=8}
if(a=='point'){oy+=bob;rx=24+alt;ry=10}
if(a=='help'){oy+=bob;lx=2+alt;ly=5;lo=alt;wr=0}
if(a=='info'){oy+=bob;ry=11;wr=0}
if(a=='success'){oy+=bob;ry=11;wr=0;face='h'}
if(a=='warn'){wr=0;ly=10;ry=12;lo=ro=alt}
if(a=='search'){oy+=bob;rx=24+alt;ry=10;wr=0}
if(a=='sleep'){oy+=bob;wr=0;blink=1}
if(a=='love'){oy+=bob;wr=0;face='h';ly=11;ry=11;lo=ro=alt}
if(a=='idea'){oy+=bob;rx=24;ry=10;wr=0}
if(a=='loading'){wr=0}
if(a=='empty'){oy+=bob;wr=0;ly=11;ry=11;lo=ro=1}
if(a=='notify'){oy+=bob;rx=24;ry=9;wr=0}
if(a=='offline'){wr=0;ly=15;ry=15;face='c'}
if(a=='lock'){wr=0;face='c';ry=11;ro=1}
if(a=='404'){oy+=bob;rx=24+alt;ry=10;wr=0;face='c'}
if(a=='upload'){oy+=bob;rx=24;ry=10;wr=0;face='h'}
if(a=='assigned'){oy+=bob;wr=0;rx=23;ry=5}
if(a=='fixing'){ry=(f%2)?17:14;spark=f&1}
if(a=='urgent'){wr=0;face='c';ly=8;ry=8;lo=ro=alt;hat=4}
if(a=='resolved'){oy+=bob;wr=0;face='h';ry=11}
if(a=='coffee'){oy+=bob;rx=24;ry=10;wr=0;blink=1}
if(a=='thanks'){oy+=((f>>3)&1)*3;wr=0;ly=16;ry=16;face='h'}
if(a=='dance'){ox=[-2,0,2,0][(f>>1)%4];oy+=alt?-1:0;wr=0;lo=ro=1;ly=alt?5:14;ry=alt?14:5;face='h'}
if(a=='birthday'){oy+=bob;wr=0;face='h';ly=5;ry=5;lo=ro=alt;hat=1}
if(a=='eat'){oy+=bob;rx=24;ry=10;wr=0;if(((f>>2)%4)==3)blink=1}
if(a=='beach'){oy+=bob;wr=0}
if(a=='christmas'){oy+=bob;wr=0;face='h';rx=24;ry=10;hat=2}
if(a=='halloween'){oy+=bob;wr=0;rx=24;ry=10;hat=3}
if(a=='key'){oy+=bob;wr=0;face='h';rx=24;ry=10}
if(a=='bell'){wr=0;rx=24;ry=alt?9:5}
R(13,22,6,1,'d');R(11,23,10,1,'d');R(11,24,3,1,'b');R(15,24,2,1,'d');R(18,24,3,1,'b');
R(10,21,2,1,'d');R(20,21,2,1,'d');
arm(8,18,lx+4,ly+3);claw(lx,ly,lo);
arm(22,18,rx,ry+3);claw(rx,ry,ro);
if(a=='think'){for(var d=0;d<((f>>2)%3)+1;d++)R(25+d*2,6-d*2,2,2,'u')}
var rows=[[9,11,20],[10,10,21],[11,9,22],[12,9,22],[13,9,22],[14,9,22],[15,9,22],[16,9,22],[17,10,21],[18,10,21],[19,11,20],[20,12,19],[21,13,18]];
rows.forEach(function(r){R(r[1],r[0],r[2]-r[1]+1,1,'b')});
R(13,17,6,3,'l');R(14,20,4,1,'l');R(13,18,6,1,'d');
R(10,14,1,1,'k');R(21,14,1,1,'k');
if(face=='h'){[[10,12],[11,11],[12,11],[13,12],[18,12],[19,11],[20,11],[21,12]].forEach(function(p){P(p[0],p[1],'o')})}
else if(blink){R(11,12,2,1,'o');R(19,12,2,1,'o')}
else{R(11,11,2,3,'w');R(19,11,2,3,'w');var py=face=='s'?12:11;R(face=='s'?11:12,py,1,2,'o');R(face=='s'?19:20,py,1,2,'o')}
if(face=='s'){[[13,16],[18,16],[14,15],[15,15],[16,15],[17,15]].forEach(function(p){P(p[0],p[1],'o')});var sy=10+(f%4);P(6,sy,'s');P(5,sy+1,'s');P(6,sy+1,'s');P(7,sy+1,'s');if((f>>1)&1)for(var t=0;t<6;t++){Q(24+t,3+t,'r');Q(25+t,3+t,'r');Q(29-t,3+t,'r');Q(30-t,3+t,'r')}}
else if(face!='c'){[[13,15],[18,15],[14,16],[15,16],[16,16],[17,16]].forEach(function(p){P(p[0],p[1],'o')})}
else{[[13,16],[18,16],[14,15],[15,15],[16,15],[17,15]].forEach(function(p){P(p[0],p[1],'o')})}
if(!hat){R(13,4,6,1,'g');R(11,5,10,1,'g');R(10,6,12,1,'g');R(15,4,2,3,'y');R(10,7,12,1,'u');R(9,8,14,1,'h')}
else if(hat==1){GL(11,2,['....yy....','...rrrr...','...rqrr...','..rrrrqr..','..rqrrrr..','.rrrrqrrr.']);R(10,8,12,1,'u')}
else if(hat==2){GL(10,3,['......rrr.ww','....rrrrrrww','...rrrrrrrr.','..rrrrrrrrrr','wwwwwwwwwwww','wwwwwwwwwwww'])}
else if(hat==3){GL(10,1,['.....vv.....','....vvvv....','....vvvv....','...vvvvvv...','...vvvvvv...','..eeeeeeee..','..vvvvvvvv..','vvvvvvvvvvvv'])}
else if(hat==4){var cc=alt?'r':'e';R(13,4,6,1,cc);R(11,5,10,1,cc);R(10,6,12,1,cc);R(15,4,2,3,'w');R(10,7,12,1,'a');R(9,8,14,1,'a')}
P(12,3,'d');P(11,2,'d');P(10+alt,1,'d');P(19,3,'d');P(20,2,'d');P(21-alt,1,'d');
if(wr){R(27,ry-3,2,9,'u');R(26,ry-6,4,3,'u');R(27,ry-6,2,1,null);if(spark){Q(25,ry-5+oy,'g');Q(30,ry-5+oy,'g');Q(27,ry-8+oy,'y')}}
if(a=='ok'||a=='birthday'){[[4,2,'g'],[27,1,'u'],[7,0,'k'],[24,3,'s'],[1,8,'y'],[30,6,'g']].forEach(function(c,k){Q(c[0],(c[1]+f+k*2)%12,c[2])})}

if(a=='help')GL(24,0,['.wwwww.','wwuuuww','wwwwuww','wwwuwww','wwwwwww','wwwuwww','.wwwww.']);
if(a=='info')GL(24,0,['.wwwww.','wwwuwww','wwwwwww','wwwuwww','wwwuwww','wwwuwww','.wwwww.']);
if(a=='success')GL(24,0,['.nnnnn.','nnnnnwn','nnnnwnn','nwnwnnn','nnwnnnn','nnnnnnn','.nnnnn.']);
if(a=='warn'&&f%4<3)GL(24,0,['...q...','..qqq..','..qoq..','.qqoqq.','.qqoqq.','qqqqqqq','qqqoqqq','qqqqqqq']);
if(a=='search'){GL(rx-1,ry-9,['.uuuuu.','uswsssu','usssssu','usssssu','usssssu','usssssu','.uuuuu.']);R(rx+2,ry-2,2,3,'u')}
if(a=='sleep'){for(var z=0;z<((f>>2)%3)+1;z++)GL(23+z*2,10-z*5,['uuuu','..u.','.u..','uuuu'],1)}
if(a=='love')GL(24,1-((f>>1)&1),['.rr.rr.','rrrrrrr','rrrrrrr','.rrrrr.','..rrr..','...r...'],1);
if(a=='idea'){GL(25,0,['.yyy.','yyyyy','yyyyy','.yyy.','..h..','..h..']);if((f>>1)&1){Q(24,2,'y');Q(30,2,'y');Q(27,0,'y');Q(23,5,'y');Q(31,5,'y')}}
if(a=='loading'){var sp=[[26,0],[29,1],[30,4],[29,7],[26,8],[23,7],[22,4],[23,1]];D(sp[f%8][0],sp[f%8][1],'u');D(sp[(f+7)%8][0],sp[(f+7)%8][1],'u');D(sp[(f+6)%8][0],sp[(f+6)%8][1],'s')}
if(a=='empty'){for(var em=0;em<=((f>>2)%3);em++)D(24+em*3,4,'a')}
if(a=='notify'){GL(24+(f&1),0,['...h...','..ggg..','.ggggg.','.ggggg.','.ggggg.','ggggggg','...h...']);if(f&1){Q(23,3,'q');Q(31,3,'q')}}
if(a=='offline'){GL(24,0,['.uuuuu.','u.....u','..uuu..','.u...u.','...u...','...u...'],1);if(alt){for(var xt=0;xt<5;xt++){Q(25+xt,1+xt,'r');Q(29-xt,1+xt,'r')}}}
if(a=='lock')GL(24+alt,0,['..aaa..','.a...a.','.a...a.','ggggggg','gggoggg','gggoggg','ggggggg']);
if(a=='404'){GL(rx-1,ry-9,['.uuuuu.','uswsssu','usssssu','usssssu','usssssu','usssssu','.uuuuu.']);R(rx+2,ry-2,2,3,'u');GL(3,0,['uuu','..u','.uu','.u.','...','.u.'])}
if(a=='upload')GL(24,0,['wwwwwww','wwwnwww','wwnnnww','wnnnnnw','wwwnwww','wwwnwww','wwwwwww']);
if(a=='assigned')GL(27,0,['..q..','qqqqq','.qqq.','qq.qq'],1);
if(a=='fixing')GL(24,0,((f>>1)&1)?['a.....a','.aaaaa.','..aaa..','..aoa..','..aaa..','.aaaaa.','a.....a']:['...a...','.aaaaa.','..aoa..','aaaaaaa','..aaa..','.aaaaa.','...a...'],1);
if(a=='urgent'&&alt){[[6,5],[5,4],[4,3],[25,5],[26,4],[27,3]].forEach(function(p){Q(p[0],p[1],'q')})}
if(a=='resolved')GL(1,0,['wwwwwww','wwwwwnw','wwwwnww','wnwnwww','wwnwwww','wwwwwww']);
if(a=='coffee'){GL(rx,ry-5,['wwwwww.','wmmmmw.','wmmmmww','wwwwwwa','.wwww..']);Q(rx+1,ry-6+oy+alt,'a');Q(rx+3,ry-7+oy-alt,'a')}
if(a=='thanks'&&alt){[[4,4],[27,3],[6,10],[26,9]].forEach(function(p){S(p[0],p[1],'q')})}
if(a=='dance')GL(26,1-alt,['..uu','..u.','..u.','uu..','uu..'],1);
if(a=='eat'){var bs=(f>>2)%4;GL(24,ry-6,['rr...rr','rrrrrrr','.rrrrr.','..r.r..'].map(function(r){return r.slice(0,7-bs*2)}))}
if(a=='beach'){R(10,11,5,3,'o');R(17,11,5,3,'o');R(15,11,2,1,'o');GL(25,0,['q.q.q','.qqq.','qqqqq','.qqq.','q.q.q'],1)}
if(a=='christmas')GL(25,1,['..q..','.qqq.','rrqrr','rrqrr','qqqqq','rrqrr']);
if(a=='halloween')GL(24,ry-8,['.e..e.','eeeeee','eoeeoe','eeeeee','.eooe.']);
if(a=='key')GL(24,ry-4,['ggg.....','g.gggggg','ggg..g.g']);
if(a=='bell'){GL(24,11,['..hh..','.gggg.','gggggg','aaaaaa']);if(alt){Q(30,11,'q');Q(31,13,'q');Q(30,15,'q')}}
var O=G.map(function(r){return r.slice()});
for(j=0;j<32;j++)for(i=0;i<32;i++)if(!G[j][i]){var n=(j>0&&G[j-1][i])||(j<31&&G[j+1][i])||(i>0&&G[j][i-1])||(i<31&&G[j][i+1]);if(n)O[j][i]=C.o}
return O}
function draw(ctx,a,f){var O=build(a,f);ctx.clearRect(0,0,32,32);for(var j=0;j<32;j++)for(var i=0;i<32;i++)if(O[j][i]){ctx.fillStyle=O[j][i];ctx.fillRect(i,j,1,1)}}
function mount(cv,a){cv.width=32;cv.height=32;var ctx=cv.getContext('2d'),f=0;draw(ctx,a,0);return setInterval(function(){f++;draw(ctx,a,f)},140)}

export {build,draw,mount};
export const ANIMS=['idle', 'wave', 'work', 'ok', 'err', 'think', 'point', 'help', 'info', 'success', 'warn', 'search', 'sleep', 'love', 'idea', 'loading', 'empty', 'notify', 'offline', 'lock', '404', 'upload', 'assigned', 'fixing', 'urgent', 'resolved', 'coffee', 'thanks', 'dance', 'birthday', 'eat', 'beach', 'christmas', 'halloween', 'key', 'bell'];
