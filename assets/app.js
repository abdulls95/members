(()=>{
"use strict";
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const dict={ar:{private:"DEVELOPMENT PREVIEW",workspace:"WORKSPACE",overview:"نظرة عامة",workspaces:"بيئات العمل",terminal:"الطرفية",toolbox:"مكتبة الأدوات",security:"مختبر الأمن",activity:"سجل النشاط",settings:"الإعدادات",localPreview:"معاينة واجهة محلية",welcome:"مركز القيادة",welcomeSub:"مساحة واحدة للبناء والتشغيل والتحكم — بأمان.",activeSessions:"جلسات نشطة",runtimePending:"بانتظار محرك التشغيل",gatewayPending:"بوابة الطرفية غير مربوطة",tools:"الأدوات",catalogPending:"المكتبة قيد التجهيز",designStage:"مرحلة التصميم",securityNotTested:"لم يبدأ اختبار الإنتاج",terminalPreview:"معاينة الطرفية",nonExecutable:"غير تنفيذية",terminalDisclaimer:"واجهة توضيحية فقط — لا تنفذ أوامر.",coreModules:"الوحدات الأساسية",workspaceDesc:"بيئات تطوير معزولة لكل مستخدم",terminalDesc:"بوابة آمنة لطرفية Linux",securityDesc:"مختبرات أمنية ضمن نطاق مصرح",toolDesc:"كتالوج أدوات وإضافات مدققة",securityRule:"قاعدة أمنية أساسية",securityRuleDesc:"لن تعمل أوامر المستخدمين على خادم التحكم الرئيسي. كل جلسة مستقبلية تحتاج بيئة معزولة وحدود موارد وشبكة وصلاحيات واضحة.",workspacePageDesc:"مساحات Linux مستقلة لكل مشروع ومستخدم.",runtimeNotReady:"محرك البيئات غير متصل",runtimeNotReadyDesc:"لن نعرض بيئة وهمية أو نسمح بتنفيذ أوامر قبل تجهيز العزل ومراقبة الموارد.",isolationDesign:"تصميم العزل متعدد المستويات",quotaDesign:"حدود CPU والذاكرة والتخزين",runtimeDeployment:"نشر محرك التشغيل",terminalPageDesc:"بوابة طرفية Linux مرتبطة ببيئة معزولة.",terminalUnavailable:"الطرفية غير متاحة بعد",terminalUnavailableDesc:"هذه النسخة لا تتصل بخادم ولا تنفذ أوامر. سنربطها ببوابة جلسات قصيرة العمر بعد اكتمال طبقة العزل.",executionDisabled:"تنفيذ الأوامر معطل",toolboxDesc:"كتالوج مركزي للأدوات الموثوقة.",osintDesc:"أدوات جمع المعلومات من المصادر المفتوحة ضمن الاستخدام المشروع.",devDesc:"أدوات بناء وفحص وتصحيح الشيفرات.",secUtilDesc:"أدوات دفاعية واختبار مصرح به.",planned:"مخطط لها",securityPageDesc:"تجارب تعليمية ودفاعية ضمن نطاقات مصرح بها.",securityControls:"ضوابط التشغيل",control1:"عزل كل مستخدم عن الآخرين",control2:"قائمة سماح للاتصالات الصادرة",control3:"حدود زمنية واستهلاك موارد",control4:"تسجيل تدقيق للأحداث المهمة",control5:"إيقاف تلقائي عند تجاوز الحدود",securityStatus:"حالة التنفيذ",policyDesign:"سياسات الأمان",documented:"موثقة",containerIsolation:"عزل الحاويات",notDeployed:"غير منشور",penetrationTesting:"اختبارات الاختراق",notStarted:"لم تبدأ",activityDesc:"أحداث النظام ستظهر هنا بعد ربط خدمات الهوية والتدقيق.",noEvents:"لا توجد أحداث بعد",auditDesc:"لم يتم توصيل أي خدمة خلفية بهذه المعاينة.",settingsDesc:"تفضيلات واجهة العرض الحالية.",language:"اللغة",languageDesc:"لغة واجهة CORNOD",privacyMode:"وضع الخصوصية",privacyDesc:"معاينة عامة؛ لا يوجد تسجيل دخول أو بيانات خاصة.",privateOnly:"معاينة عامة"},en:{private:"DEVELOPMENT PREVIEW",workspace:"WORKSPACE",overview:"Overview",workspaces:"Workspaces",terminal:"Terminal",toolbox:"Tool Library",security:"Security Lab",activity:"Activity Log",settings:"Settings",localPreview:"Local interface preview",welcome:"Control Center",welcomeSub:"One place to build, operate and control — securely.",activeSessions:"Active sessions",runtimePending:"Runtime engine pending",gatewayPending:"Terminal gateway not connected",tools:"Tools",catalogPending:"Catalog in preparation",designStage:"Design stage",securityNotTested:"Production testing not started",terminalPreview:"Terminal preview",nonExecutable:"NON-EXECUTABLE",terminalDisclaimer:"Static preview only — commands are not executed.",coreModules:"Core modules",workspaceDesc:"Isolated development environments per user",terminalDesc:"Secure Linux terminal gateway",securityDesc:"Security labs within authorized scope",toolDesc:"Curated tools and extensions catalog",securityRule:"Security baseline",securityRuleDesc:"User commands will never run on the control-plane host. Every future session requires an isolated environment with explicit resource, network and permission boundaries.",workspacePageDesc:"Independent Linux workspaces for every project and user.",runtimeNotReady:"Workspace runtime is not connected",runtimeNotReadyDesc:"We will not display a fake environment or allow command execution before isolation and resource monitoring are ready.",isolationDesign:"Layered isolation design",quotaDesign:"CPU, memory and storage quotas",runtimeDeployment:"Deploy runtime engine",terminalPageDesc:"Linux terminal gateway connected to an isolated workspace.",terminalUnavailable:"Terminal is not available yet",terminalUnavailableDesc:"This build is not connected to a server and does not execute commands. A short-lived session gateway will be connected after the isolation layer is complete.",executionDisabled:"COMMAND EXECUTION DISABLED",toolboxDesc:"A central catalog of trusted tools.",osintDesc:"Open-source intelligence tools for legitimate use.",devDesc:"Tools for building, inspecting and debugging code.",secUtilDesc:"Defensive and authorized testing utilities.",planned:"PLANNED",securityPageDesc:"Educational and defensive exercises within authorized scope.",securityControls:"Execution controls",control1:"Isolate every user from others",control2:"Outbound network allowlist",control3:"Time and resource limits",control4:"Audit important events",control5:"Automatic shutdown on limit breach",securityStatus:"Implementation status",policyDesign:"Security policies",documented:"DOCUMENTED",containerIsolation:"Container isolation",notDeployed:"NOT DEPLOYED",penetrationTesting:"Penetration testing",notStarted:"NOT STARTED",activityDesc:"System events will appear here after identity and audit services are connected.",noEvents:"No events yet",auditDesc:"No backend service is connected to this preview.",settingsDesc:"Current interface preferences.",language:"Language",languageDesc:"CORNOD interface language",privacyMode:"Privacy mode",privacyDesc:"Public preview; no sign-in or private data.",privateOnly:"PUBLIC PREVIEW"}};
let lang="ar";

function setLang(next){
  if(!Object.hasOwn(dict,next)) return;
  lang=next;
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==="ar"?"rtl":"ltr";
  $$("[data-i18n]").forEach(el=>{
    const value=dict[lang][el.dataset.i18n];
    if(typeof value==="string") el.textContent=value;
  });
  const toggle=$("#languageToggle");
  if(toggle) toggle.textContent=lang==="ar"?"EN":"ع";
  const second=$("#languageToggle2");
  if(second) second.textContent=lang==="ar"?"Switch to English":"التبديل للعربية";
  document.documentElement.dataset.language=lang;
}

function go(page,{focusMain=false}={}){
  const target=$('[data-view="'+page+'"]');
  if(!target) page="overview";
  $$(".page").forEach(section=>{
    const active=section.dataset.view===page;
    section.classList.toggle("active",active);
    section.setAttribute("aria-hidden",String(!active));
  });
  $$(".nav-link").forEach(link=>{
    const active=link.dataset.page===page;
    link.classList.toggle("active",active);
    if(active) link.setAttribute("aria-current","page");
    else link.removeAttribute("aria-current");
  });
  const sidebar=$("#sidebar");
  const menu=$("#menuToggle");
  if(sidebar) sidebar.classList.remove("open");
  if(menu) menu.setAttribute("aria-expanded","false");
  if(location.hash!=="#"+page) history.replaceState(null,"","#"+page);
  if(focusMain) $("#main")?.focus({preventScroll:true});
}

function toggleLang(){setLang(lang==="ar"?"en":"ar");}
function setMenu(open){
  $("#sidebar")?.classList.toggle("open",open);
  $("#menuToggle")?.setAttribute("aria-expanded",String(open));
}

$("#languageToggle")?.addEventListener("click",toggleLang);
$("#languageToggle2")?.addEventListener("click",toggleLang);
$("#menuToggle")?.addEventListener("click",()=>setMenu(!$("#sidebar")?.classList.contains("open")));
$$("[data-page]").forEach(link=>link.addEventListener("click",event=>{
  event.preventDefault();
  go(link.dataset.page,{focusMain:true});
}));
$$("[data-go]").forEach(link=>link.addEventListener("click",event=>{
  event.preventDefault();
  go(link.dataset.go,{focusMain:true});
}));
window.addEventListener("hashchange",()=>go(location.hash.slice(1)||"overview"));
document.addEventListener("keydown",event=>{
  if(event.key==="Escape") setMenu(false);
});
setLang(lang);
go(location.hash.slice(1)||"overview");
})();