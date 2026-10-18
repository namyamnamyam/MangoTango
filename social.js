/* MangoPen v0.5 beta — Supabase-backed social profiles, follows, feed, and likes.
   Social data is shared; old browser-local drafts remain unchanged. */
(function(){
"use strict";
var page="feed",scope="all",profileId=null,listKind=null,serial=0,me=null;
var profileCache={};
var nav=document.querySelector(".top .nav");
if(!nav||typeof render!=="function"||typeof api!=="function")return;
var navButton=document.createElement("button");
navButton.id="mangopen-social-nav";navButton.type="button";navButton.textContent="피드";
nav.appendChild(navButton);
var previousRender=render;
render=function(){
 previousRender();
 navButton.classList.toggle("active",screen==="social");
 if(screen==="social")draw();
 if(screen==="account"&&auth&&auth.user){
  var actions=document.querySelector("#app .panel .actions");
  if(actions){var b=document.createElement("button");b.type="button";b.className="outline";b.textContent="내 프로필";b.onclick=function(){show("profile",auth.user.id)};actions.appendChild(b)}
 }
};
function show(p,id){page=p;profileId=id||null;listKind=null;screen="social";render();window.scrollTo(0,0)}
navButton.onclick=function(){show("feed")};
function E(x){return esc(x)}
function note(t){return '<div class="empty">'+E(t)+'</div>'}
function fail(err){return '<div class="mp-error" role="alert"><strong>소셜 데이터를 불러올 수 없어.</strong><p>'+E(err&&err.message||"연결을 확인해 줘.")+'</p><small>데이터베이스 업데이트가 아직 반영되지 않았을 수 있어. 기존 원고는 영향을 받지 않아.</small></div>'}
function base(){return '<div class="mp-heading"><div><div class="sub">MANGOPEN COMMUNITY · BETA</div><h2>작가 커뮤니티</h2><p class="muted">작가를 발견하고 새 소식을 나눠 보세요.</p></div></div><div class="mp-tabs"><button data-mp-page="feed" class="'+(page==="feed"?"active":"")+'">새 소식</button><button data-mp-page="people" class="'+(page==="people"?"active":"")+'">작가 찾기</button><button data-mp-page="profile" class="'+(page==="profile"?"active":"")+'">내 프로필</button></div><div id="mp-content"><div class="empty">불러오는 중…</div></div>'}
function avatar(p,size){
 var path=p&&p.avatar_path||"";
 var legal=/^[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/.test(path);
 return '<span class="mp-avatar '+(size==="big"?"big":"")+'">'+(legal?'<img loading="lazy" alt="" src="'+E(SUPA_URL+'/storage/v1/object/public/mangopen-avatars/'+path)+'">':'✳')+'</span>';
}
function profileLink(p){return '<button class="mp-person" data-mp-profile="'+E(p.id)+'">'+avatar(p)+'<span><strong>'+E(p.display_name||"작가")+'</strong><small>@'+E(p.username||"")+'</small></span></button>'}
function qs(table,query,token){return api("/rest/v1/"+table+"?"+query,"GET",undefined,token)}
function requireLogin(){if(!auth||!auth.user){alert("먼저 로그인해 줘.");go("account");return false}return true}
async function getMe(){
 var token=await validSession();if(!token||!auth||!auth.user)return null;
 var id=auth.user.id;
 var rows=await qs("profiles","select=*&id=eq."+encodeURIComponent(id)+"&limit=1",token);
 if(rows.length){me=rows[0];profileCache[id]=me;return token}
 var fallback="writer_"+id.replace(/-/g,"").slice(0,12);
 var display="새로운 작가";
 var r=await api("/rest/v1/profiles","POST",{id:id,username:fallback,display_name:display},token);
 me=r[0];profileCache[id]=me;return token;
}
function draw(){
 var thisView=++serial,app=document.getElementById("app");if(!app)return;
 app.innerHTML=base();
 (async function(){
  try{
   var token=await getMe(),content="";
   if(page==="feed")content=await feed(token);
   else if(page==="people")content=await people(token);
   else content=await profile(token,profileId||(auth&&auth.user&&auth.user.id));
   if(thisView===serial&&screen==="social"){var el=document.getElementById("mp-content");if(el)el.innerHTML=content}
  }catch(e){if(thisView===serial&&screen==="social"){var el=document.getElementById("mp-content");if(el)el.innerHTML=fail(e)}}
 })();
}
function compose(){return auth&&auth.user?'<form id="mp-compose" class="mp-composer"><strong>오늘의 한마디 ✍️</strong><textarea name="body" maxlength="1000" rows="3" required placeholder="작업 근황, 새 작품 소식, 작가에게 하고 싶은 이야기…"></textarea><div class="mp-formfoot"><small>최대 1,000자 · 전체 공개 게시글</small><button class="primary" type="submit">게시하기</button></div></form>':'<div class="mp-composer"><strong>작가가 되어 대화에 참여해 보세요!</strong><p class="muted">로그인하면 게시글 작성, 좋아요, 팔로우를 할 수 있어.</p><button class="primary" type="button" data-mp-login="1">로그인</button></div>'}
async function profilesFor(ids,token){
 if(!ids.length)return {};
 var arr=await qs("profiles","select=*&id=in.("+ids.join(",")+")",token),map={};
 arr.forEach(function(p){map[p.id]=p;profileCache[p.id]=p});return map;
}
async function decoratePosts(posts,token){
 if(!posts.length)return "";
 var ids=[...new Set(posts.map(function(p){return p.author_id}))];
 var profiles=await profilesFor(ids,token);
 var likes=await qs("post_likes","select=post_id,user_id&post_id=in.("+posts.map(function(p){return p.id}).join(",")+")",token),counts={},liked={};
 likes.forEach(function(l){counts[l.post_id]=(counts[l.post_id]||0)+1;if(auth&&auth.user&&l.user_id===auth.user.id)liked[l.post_id]=true});
 return posts.map(function(p){
  var own=auth&&auth.user&&p.author_id===auth.user.id;
  var d=profiles[p.author_id]||{id:p.author_id,display_name:"알 수 없는 작가",username:"writer"};
  var date=new Date(p.created_at).toLocaleString("ko-KR",{dateStyle:"medium",timeStyle:"short"});
  return '<article class="mp-post">'+profileLink(d)+'<span class="mp-date">'+E(date)+'</span><p class="mp-body">'+E(p.body)+'</p><div class="mp-postactions"><button class="outline" data-mp-like="'+E(p.id)+'" data-on="'+(liked[p.id]?"1":"0")+'">'+(liked[p.id]?"♥":"♡")+' 좋아요 '+(counts[p.id]||0)+'</button>'+(own?'<button class="outline danger" data-mp-delete="'+E(p.id)+'">삭제</button>':(auth&&auth.user?'<button class="outline" data-mp-report="'+E(p.id)+'">신고</button>':""))+'</div></article>';
 }).join("");
}
async function feed(token){
 var controls='<div class="mp-scope"><button data-mp-scope="all" class="chip '+(scope==="all"?"active":"")+'">전체</button><button data-mp-scope="following" class="chip '+(scope==="following"?"active":"")+'">팔로잉</button></div>';
 if(scope==="following"&&(!auth||!auth.user))return compose()+controls+note("팔로잉 피드는 로그인 후 이용할 수 있어.");
 var filter="";
 if(scope==="following"){
  var f=await qs("follows","select=following_id&follower_id=eq."+auth.user.id,token);
  if(!f.length)return compose()+controls+note("아직 팔로우한 작가가 없어. 작가 찾기에서 팔로우해 봐!");
  filter="&author_id=in.("+f.map(function(x){return x.following_id}).join(",")+")";
 }
 var posts=await qs("posts","select=id,author_id,body,created_at&order=created_at.desc&limit=40"+filter,token);
 return compose()+controls+(posts.length?'<div class="mp-posts">'+await decoratePosts(posts,token)+'</div>':note("첫 글을 기다리고 있어!"));
}
async function people(token){
 var arr=await qs("profiles","select=*&order=created_at.desc&limit=50",token);
 var following={};
 if(auth&&auth.user){var mine=await qs("follows","select=following_id&follower_id=eq."+auth.user.id,token);mine.forEach(function(f){following[f.following_id]=true})}
 if(!arr.length)return note("아직 등록된 작가가 없어.");
 return '<div class="mp-search"><input id="mp-find" placeholder="닉네임 또는 @아이디 검색" aria-label="작가 검색"></div><div class="mp-people">'+arr.map(function(p){return '<div class="mp-user" data-mp-search="'+E((p.username+" "+p.display_name).toLowerCase())+'">'+profileLink(p)+(auth&&auth.user&&p.id!==auth.user.id?'<button class="'+(following[p.id]?"outline":"primary")+'" data-mp-follow="'+E(p.id)+'" data-on="'+(following[p.id]?"1":"0")+'">'+(following[p.id]?"팔로잉 ✓":"팔로우")+'</button>':"")+'</div>'}).join("")+'</div>';
}
async function profile(token,id){
 if(!id)return '<div class="panel"><h2>프로필을 만들려면 로그인해 줘.</h2><button class="primary" data-mp-login="1">로그인</button></div>';
 var a=await qs("profiles","select=*&id=eq."+id+"&limit=1",token),p=a[0];
 if(!p)return note("작가를 찾을 수 없어.");
 var mine=auth&&auth.user&&auth.user.id===id;
 var followers=await qs("follows","select=follower_id&following_id=eq."+id,token);
 var following=await qs("follows","select=following_id&follower_id=eq."+id,token);
 var already=!mine&&auth&&auth.user&&followers.some(function(f){return f.follower_id===auth.user.id});
 var html='<div class="mp-profile"><div class="mp-profiletop">'+avatar(p,"big")+'<div class="mp-profiletext"><h2>'+E(p.display_name)+'</h2><p class="muted">@'+E(p.username)+'</p><p class="mp-body">'+E(p.bio||"소개를 작성해 보세요.")+'</p></div></div><div class="mp-stats"><button data-mp-list="followers"><b>'+followers.length+'</b><small>팔로워</small></button><button data-mp-list="following"><b>'+following.length+'</b><small>팔로잉</small></button></div>'+(!mine?(auth&&auth.user?'<button class="'+(already?"outline":"primary")+'" data-mp-follow="'+E(id)+'" data-on="'+(already?"1":"0")+'">'+(already?"팔로잉 ✓":"팔로우")+'</button>':'<button class="primary" data-mp-login="1">팔로우하려면 로그인</button>'):'')+'</div>';
 if(listKind){
  var userIds=(listKind==="followers"?followers.map(function(f){return f.follower_id}):following.map(function(f){return f.following_id}));
  var profiles=await profilesFor(userIds,token);
  html+='<section class="mp-list"><h3>'+(listKind==="followers"?"팔로워":"팔로잉")+'</h3>'+(userIds.map(function(uid){return profiles[uid]?profileLink(profiles[uid]):""}).join("")||note("아직 없어."))+'</section>';
 }
 if(mine){
  html+='<form id="mp-profile-form" class="panel mp-edit"><h3>내 프로필 수정</h3><label class="field">고유 아이디 (@영문·숫자·밑줄, 3~24자)<input name="username" required maxlength="24" minlength="3" pattern="[a-z0-9_]{3,24}" value="'+E(p.username)+'"></label><label class="field">닉네임<input name="display_name" maxlength="40" required value="'+E(p.display_name)+'"></label><label class="field">소개<textarea name="bio" maxlength="300" rows="3">'+E(p.bio||"")+'</textarea></label><label class="field">프로필 사진 (PNG/JPG/WebP, 최대 2MB)<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="primary" type="submit">프로필 저장</button></form>';
 }
 var posts=await qs("posts","select=id,author_id,body,created_at&author_id=eq."+id+"&order=created_at.desc&limit=30",token);
 html+='<h3 class="mp-section-title">게시글 '+posts.length+'개</h3>'+(posts.length?'<div class="mp-posts">'+await decoratePosts(posts,token)+'</div>':note("아직 작성한 글이 없어."));
 return html;
}
async function photoUpload(file,token){
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("JPG, PNG, WebP 이미지만 사용할 수 있어.");
 if(file.size>2*1024*1024)throw Error("사진 크기는 2MB 이하여야 해.");
 if(!auth||!auth.user)throw Error("로그인 필요");
 var ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
 var path=auth.user.id+"/"+(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2))+"."+ext;
 var r=await fetch(SUPA_URL+"/storage/v1/object/mangopen-avatars/"+path,{method:"POST",headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+token,"Content-Type":file.type,"x-upsert":"false"},body:file});
 var d=await r.json().catch(function(){return {}});
 if(!r.ok)throw Error(d.message||d.error||"사진 업로드 실패");
 return path;
}
async function action(button){
 if(button.dataset.mpLogin){go("account");return}
 if(button.dataset.mpPage){show(button.dataset.mpPage,button.dataset.mpPage==="profile"?(auth&&auth.user&&auth.user.id):null);return}
 if(button.dataset.mpScope){scope=button.dataset.mpScope;draw();return}
 if(button.dataset.mpProfile){show("profile",button.dataset.mpProfile);return}
 if(button.dataset.mpList){listKind=(listKind===button.dataset.mpList?null:button.dataset.mpList);draw();return}
 if(button.dataset.mpFollow){
  if(!requireLogin())return;
  var token=await getMe(),id=button.dataset.mpFollow;
  if(id===auth.user.id)return;
  button.disabled=true;
  try{if(button.dataset.on==="1")await api("/rest/v1/follows?follower_id=eq."+auth.user.id+"&following_id=eq."+id,"DELETE",undefined,token);
  else await api("/rest/v1/follows","POST",{follower_id:auth.user.id,following_id:id},token);draw()}
  finally{button.disabled=false}
  return;
 }
 if(button.dataset.mpLike){
  if(!requireLogin())return;
  var t=await getMe(),pid=button.dataset.mpLike;button.disabled=true;
  try{if(button.dataset.on==="1")await api("/rest/v1/post_likes?post_id=eq."+pid+"&user_id=eq."+auth.user.id,"DELETE",undefined,t);
  else await api("/rest/v1/post_likes","POST",{post_id:pid,user_id:auth.user.id},t);draw()}
  finally{button.disabled=false}
  return;
 }
 if(button.dataset.mpDelete){
  if(!requireLogin())return;
  if(!confirm("이 게시글을 삭제할까? 되돌릴 수 없어."))return;
  var tok=await validSession();await api("/rest/v1/posts?id=eq."+button.dataset.mpDelete+"&author_id=eq."+auth.user.id,"DELETE",undefined,tok);draw();return;
 }
 if(button.dataset.mpReport){
  if(!requireLogin())return;
  var reason=prompt("신고 사유를 입력해 줘 (2~200자).","");
  if(reason===null)return;reason=reason.trim();
  if(reason.length<2||reason.length>200){alert("신고 사유는 2~200자로 입력해 줘.");return}
  var t=await getMe();await api("/rest/v1/post_reports","POST",{post_id:button.dataset.mpReport,reporter_id:auth.user.id,reason:reason},t);alert("신고가 접수됐어.");return;
 }
}
document.addEventListener("click",function(e){
 var b=e.target.closest("button[data-mp-login],button[data-mp-page],button[data-mp-scope],button[data-mp-profile],button[data-mp-list],button[data-mp-follow],button[data-mp-like],button[data-mp-delete],button[data-mp-report]");
 if(!b||b.disabled)return;
 action(b).catch(function(err){alert("요청 실패: "+(err&&err.message||"네트워크 오류"));draw()});
});
document.addEventListener("input",function(e){if(e.target.id==="mp-find"){var q=e.target.value.toLowerCase();document.querySelectorAll(".mp-user").forEach(function(el){el.hidden=!el.dataset.mpSearch.includes(q)})}});
document.addEventListener("submit",async function(e){
 if(!e.target||!["mp-compose","mp-profile-form"].includes(e.target.id))return;
 e.preventDefault();var form=e.target,btn=form.querySelector("[type=submit]");if(btn)btn.disabled=true;
 try{
  if(!requireLogin())return;
  var token=await getMe(),data=new FormData(form);
  if(form.id==="mp-compose"){
   var body=String(data.get("body")||"").trim();if(!body||body.length>1000)throw Error("본문은 1~1000자로 입력해 줘.");
   await api("/rest/v1/posts","POST",{author_id:auth.user.id,body:body},token);page="feed";draw();
  }else{
   var username=String(data.get("username")||"").trim().toLowerCase();
   var name=String(data.get("display_name")||"").trim();
   var bio=String(data.get("bio")||"").trim();
   if(!/^[a-z0-9_]{3,24}$/.test(username))throw Error("아이디는 영문 소문자·숫자·밑줄 3~24자로 입력해 줘.");
   if(!name||name.length>40||bio.length>300)throw Error("닉네임 또는 소개 글자 수를 확인해 줘.");
   var update={username:username,display_name:name,bio:bio,updated_at:new Date().toISOString()};
   var pic=data.get("avatar");if(pic&&pic.size)update.avatar_path=await photoUpload(pic,token);
   await api("/rest/v1/profiles?id=eq."+auth.user.id,"PATCH",update,token);
   me=Object.assign({},me,update);alert("프로필을 저장했어!");draw();
  }
 }catch(err){alert("저장 실패: "+(err&&err.message||"요청 오류"))}
 finally{if(btn&&btn.isConnected)btn.disabled=false}
});
})();