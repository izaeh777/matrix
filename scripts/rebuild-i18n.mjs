import fs from 'fs'

const path = 'common/i18n.uts'
let src = fs.readFileSync(path, 'utf8')

function extractPack(name) {
	const re = new RegExp(`fillPack\\(${name}, \\[([\\s\\S]*?)\\]\\)`)
	const m = src.match(re)
	if (!m) throw new Error('missing ' + name)
	const body = m[1]
	const pairs = []
	const itemRe = /'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'/g
	let x
	while ((x = itemRe.exec(body)) != null) {
		pairs.push([x[1].replace(/\\'/g, "'"), x[2].replace(/\\'/g, "'")])
	}
	return pairs
}

function esc(s) {
	return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function emitPack(varName, pairs) {
	const lines = pairs.map(([k, v]) => `\t'${esc(k)}', '${esc(v)}',`)
	// drop trailing comma on last? keep commas like original, last line also has comma before ])
	return `fillPack(${varName}, [\n${lines.join('\n').replace(/,$/, '')}\n])`
}

const zh = extractPack('MSG_ZH_HANS')
const tw = extractPack('MSG_ZH_HANT')
const en = extractPack('MSG_EN')
const ja = extractPack('MSG_JA')
const ko = extractPack('MSG_KO')
const ru = extractPack('MSG_RU')

function patch(pairs, map) {
	return pairs.map(([k, v]) => [k, map[k] != null ? map[k] : v])
}

const zhPatched = patch(zh, {
	'profile.chat': '商务洽谈',
	'chat.title': '洽谈',
	'chat.filterRecent': '最近洽谈',
	'chat.emptyHint': '点击右上角 ＋ 发起洽谈室或加入洽谈室',
	'pub.uploadHint': '支持jpg/png，大小不超过2MB'
})
const twPatched = patch(tw, {
	'profile.chat': '商務洽談',
	'chat.title': '洽談',
	'chat.filterRecent': '最近洽談',
	'chat.emptyHint': '點擊右上角 ＋ 發起洽談室或加入洽談室'
})
const enPatched = patch(en, {
	'profile.chat': 'Business talks',
	'chat.title': 'Talks',
	'chat.emptyHint': 'Tap ＋ to start a talk room or join one'
})
const jaPatched = patch(ja, {
	'profile.chat': 'ビジネス商談',
	'chat.title': '商談'
})
const koPatched = patch(ko, {
	'profile.chat': '비즈니스 상담',
	'chat.title': '상담'
})
const ruPatched = patch(ru, {
	'profile.chat': 'Деловые переговоры',
	'chat.title': 'Переговоры'
})

function fromEn(overrides) {
	return enPatched.map(([k, v]) => [k, overrides[k] != null ? overrides[k] : v])
}

const fr = fromEn({
	'lang.title': 'Langue',
	'common.confirm': 'OK',
	'common.cancel': 'Annuler',
	'common.soon': 'Bientôt',
	'common.more': 'Plus ›',
	'common.loading': 'Chargement…',
	'common.empty': 'Aucune donnée',
	'home.banner1': 'Découvrir des projets',
	'home.banner2': 'Saisir les opportunités',
	'home.bannerSub1': 'Web3 · échange · collab',
	'home.bannerSub2': 'Plateforme',
	'home.publish': 'Publier',
	'home.search': 'Rechercher',
	'home.latest': 'Dernières',
	'home.hot': 'Projets populaires',
	'home.viewMore': 'Voir plus ›',
	'home.emptyNews': 'Pas d’actus',
	'home.emptyProject': 'Pas de projets',
	'home.friends': 'Liens',
	'notify.title1a': 'Actus',
	'notify.title1b': '',
	'notify.title2a': '&',
	'notify.title2b': 'Fil',
	'notify.empty': 'Pas d’infos',
	'notify.loading': 'Chargement…',
	'notify.likes': ' j’aime',
	'profile.balance': 'Solde USDT',
	'profile.fav': 'Favoris',
	'profile.history': 'Historique',
	'profile.emptyRec': 'Aucun enregistrement',
	'profile.analytics': 'Analyses',
	'profile.chat': 'Négociations',
	'profile.share': 'Revenus',
	'profile.service': 'Service',
	'profile.center': 'Fonctions',
	'profile.myPublish': 'Mes publications',
	'profile.follow': 'Abonnements',
	'profile.invite': 'Inviter',
	'invite.title': 'Inviter des amis',
	'invite.desc': 'Partagez votre code d’invitation',
	'invite.myCode': 'Mon code',
	'invite.scan': 'Scanner',
	'invite.searchUser': 'Chercher un utilisateur',
	'invite.enterUser': 'Saisir le nom',
	'login.wallet': 'Connexion wallet',
	'login.mail': 'Connexion e-mail',
	'login.register': 'S’inscrire',
	'login.welcome': 'Bon retour',
	'login.create': 'Créer un compte',
	'chat.title': 'Pourparlers',
	'chat.filterAll': 'Tout',
	'chat.filterRecent': 'Récents',
	'chat.filterUnread': 'Non lus',
	'chat.reject': 'Refuser',
	'chat.accept': 'Accepter',
	'chat.answer': 'Répondre',
	'chat.inviteBanner': 'Vous avez {n} invitation(s)',
	'chat.from': 'De : ',
	'chat.needLogin': 'Chat non connecté',
	'chat.needLoginHint': 'Connectez-vous à Matrix pour discuter.',
	'chat.loginMatrix': 'Connexion chat',
	'chat.empty': 'Aucune conversation',
	'chat.emptyHint': 'Touchez ＋ pour créer ou rejoindre une salle',
	'chat.inviteMember': 'Inviter',
	'chat.deleteChat': 'Supprimer',
	'chat.pin': 'Épingler',
	'chat.unpin': 'Désépingler',
	'chat.mute': 'Muet',
	'chat.unmute': 'Réactiver',
	'chat.noMessage': 'Pas de message',
	'chat.yesterday': 'Hier',
	'chat.send': 'Envoyer',
	'chat.inputPh': 'Écrire un message',
	'pub.title': 'Publier un projet',
	'pub.draft': 'Brouillon',
	'pub.step1': 'Bases',
	'pub.step2': 'À propos',
	'pub.step3': 'Fichiers',
	'pub.step4': 'Soumettre',
	'pub.name': 'Nom du projet',
	'pub.namePh': 'Nom (min. 5)',
	'pub.category': 'Catégorie',
	'pub.categoryPh': 'Choisir',
	'pub.intro': 'Résumé',
	'pub.introPh': 'Résumé (min. 20)',
	'pub.logo': 'Logo',
	'pub.uploadLogo': 'Téléverser le logo',
	'pub.uploadHint': 'jpg/png, max 2 Mo',
	'pub.cover': 'Couverture',
	'pub.uploadCover': 'Téléverser la couverture',
	'pub.coverHint': 'Recommandé 1280×720',
	'pub.highlight': 'Points forts',
	'pub.highlightPh': 'Points forts (min. 5)',
	'pub.audience': 'Public cible',
	'pub.audiencePh': 'Décrire le public',
	'pub.detail': 'Détails',
	'pub.detailPh': 'Détails (min. 20)',
	'pub.material': 'Documents',
	'pub.uploadMaterial': 'Téléverser',
	'pub.coverPreview': 'Aperçu',
	'pub.reviewTitle': 'Vérifier puis soumettre',
	'pub.reviewName': 'Nom : ',
	'pub.reviewCat': 'Catégorie : ',
	'pub.reviewIntro': 'Résumé : ',
	'pub.reviewHighlight': 'Points forts : ',
	'pub.next': 'Suivant',
	'pub.prev': 'Retour',
	'pub.submit': 'Soumettre',
	'pub.submitting': 'Envoi…',
	'pub.visitorBlock': 'Les visiteurs ne peuvent pas publier. Abonnez-vous.',
	'api.visitor': 'Visiteur',
	'api.normalUser': 'Gratuit',
	'api.member': 'Membre',
	'api.owner': 'Porteur de projet',
	'api.leader': 'Leader communauté',
	'api.subActive': 'Abonnement actif',
	'api.subNone': 'Pas d’abonnement',
	'api.subExpired': 'Abonnement expiré',
	'api.pendingPay': 'Paiement en attente',
	'api.periodRange': 'Valide : {s} – {e}',
	'api.periodUntil': 'Valable jusqu’au {e}',
	'api.remainDays': '{n} jours restants',
	'api.goSubscribe': 'S’abonner',
	'api.renew': 'Renouveler',
	'api.catAll': 'Tout',
	'api.catFinance': 'Finance',
	'api.catLive': 'Live',
	'api.catWeb3': 'Web3',
	'api.catDefi': 'DeFi',
	'api.catProject': 'Projets',
	'api.catOther': 'Autre',
	'api.tagOriginal': 'Original',
	'api.tagFromX': 'Depuis X',
	'api.memberSuffix': ' Membre'
})

const de = fromEn({
	'lang.title': 'Sprache',
	'common.confirm': 'OK',
	'common.cancel': 'Abbrechen',
	'common.soon': 'Demnächst',
	'common.more': 'Mehr ›',
	'common.loading': 'Laden…',
	'common.empty': 'Keine Daten',
	'home.banner1': 'Projekte entdecken',
	'home.banner2': 'Chancen nutzen',
	'home.bannerSub1': 'Web3 · Chat · Collab',
	'home.bannerSub2': 'Plattform',
	'home.publish': 'Veröffentlichen',
	'home.search': 'Suchen',
	'home.latest': 'Neueste',
	'home.hot': 'Beliebte Projekte',
	'home.viewMore': 'Mehr ›',
	'home.emptyNews': 'Keine Updates',
	'home.emptyProject': 'Keine Projekte',
	'home.friends': 'Links',
	'notify.title1a': 'News',
	'notify.title1b': '',
	'notify.title2a': '&',
	'notify.title2b': 'Feed',
	'notify.empty': 'Keine News',
	'notify.loading': 'Laden…',
	'notify.likes': ' Likes',
	'profile.balance': 'USDT-Guthaben',
	'profile.fav': 'Favoriten',
	'profile.history': 'Verlauf',
	'profile.emptyRec': 'Keine Einträge',
	'profile.analytics': 'Analyse',
	'profile.chat': 'Geschäftsgespräche',
	'profile.share': 'Einnahmen',
	'profile.service': 'Service',
	'profile.center': 'Funktionen',
	'profile.myPublish': 'Meine Posts',
	'profile.follow': 'Folgen',
	'profile.invite': 'Einladen',
	'invite.title': 'Freunde einladen',
	'invite.desc': 'Teile deinen Einladungscode',
	'invite.myCode': 'Mein Code',
	'invite.scan': 'Scannen',
	'invite.searchUser': 'Nutzer suchen',
	'invite.enterUser': 'Benutzernamen eingeben',
	'login.wallet': 'Wallet-Login',
	'login.mail': 'E-Mail-Login',
	'login.register': 'Registrieren',
	'login.welcome': 'Willkommen zurück',
	'login.create': 'Konto erstellen',
	'chat.title': 'Gespräche',
	'chat.filterAll': 'Alle',
	'chat.filterRecent': 'Kürzlich',
	'chat.filterUnread': 'Ungelesen',
	'chat.reject': 'Ablehnen',
	'chat.accept': 'Annehmen',
	'chat.answer': 'Annehmen',
	'chat.inviteBanner': 'Du hast {n} Einladung(en)',
	'chat.from': 'Von: ',
	'chat.needLogin': 'Chat nicht angemeldet',
	'chat.needLoginHint': 'Für Nachrichten bei Matrix anmelden.',
	'chat.loginMatrix': 'Chat anmelden',
	'chat.empty': 'Noch keine Chats',
	'chat.emptyHint': 'Tippe ＋ zum Starten oder Beitreten',
	'chat.inviteMember': 'Einladen',
	'chat.deleteChat': 'Löschen',
	'chat.pin': 'Anheften',
	'chat.unpin': 'Lösen',
	'chat.mute': 'Stumm',
	'chat.unmute': 'Ton an',
	'chat.noMessage': 'Keine Nachrichten',
	'chat.yesterday': 'Gestern',
	'chat.send': 'Senden',
	'chat.inputPh': 'Nachricht eingeben',
	'pub.title': 'Projekt veröffentlichen',
	'pub.draft': 'Entwurf',
	'pub.step1': 'Basis',
	'pub.step2': 'Über',
	'pub.step3': 'Dateien',
	'pub.step4': 'Einreichen',
	'pub.name': 'Projektname',
	'pub.namePh': 'Name (min. 5)',
	'pub.category': 'Kategorie',
	'pub.categoryPh': 'Auswählen',
	'pub.intro': 'Kurztext',
	'pub.introPh': 'Kurztext (min. 20)',
	'pub.logo': 'Logo',
	'pub.uploadLogo': 'Logo hochladen',
	'pub.uploadHint': 'jpg/png, max. 2MB',
	'pub.cover': 'Cover',
	'pub.uploadCover': 'Cover hochladen',
	'pub.coverHint': 'Empfohlen 1280×720',
	'pub.highlight': 'Highlights',
	'pub.highlightPh': 'Highlights (min. 5)',
	'pub.audience': 'Zielgruppe',
	'pub.audiencePh': 'Zielgruppe beschreiben',
	'pub.detail': 'Details',
	'pub.detailPh': 'Details (min. 20)',
	'pub.material': 'Materialien',
	'pub.uploadMaterial': 'Hochladen',
	'pub.coverPreview': 'Vorschau',
	'pub.reviewTitle': 'Prüfen und einreichen',
	'pub.reviewName': 'Name: ',
	'pub.reviewCat': 'Kategorie: ',
	'pub.reviewIntro': 'Kurztext: ',
	'pub.reviewHighlight': 'Highlights: ',
	'pub.next': 'Weiter',
	'pub.prev': 'Zurück',
	'pub.submit': 'Einreichen',
	'pub.submitting': 'Senden…',
	'pub.visitorBlock': 'Gäste können nicht veröffentlichen. Bitte abonnieren.',
	'api.visitor': 'Gast',
	'api.normalUser': 'Kostenlos',
	'api.member': 'Mitglied',
	'api.owner': 'Projektinhaber',
	'api.leader': 'Community-Lead',
	'api.subActive': 'Abo aktiv',
	'api.subNone': 'Kein aktives Abo',
	'api.subExpired': 'Abo abgelaufen',
	'api.pendingPay': 'Zahlung ausstehend',
	'api.periodRange': 'Gültig: {s} – {e}',
	'api.periodUntil': 'Gültig bis {e}',
	'api.remainDays': 'Noch {n} Tage',
	'api.goSubscribe': 'Abonnieren',
	'api.renew': 'Verlängern',
	'api.catAll': 'Alle',
	'api.catFinance': 'Finanzen',
	'api.catLive': 'Live',
	'api.catWeb3': 'Web3',
	'api.catDefi': 'DeFi',
	'api.catProject': 'Projekte',
	'api.catOther': 'Sonstiges',
	'api.tagOriginal': 'Original',
	'api.tagFromX': 'Von X',
	'api.memberSuffix': ' Mitglied'
})

const es = fromEn({
	'lang.title': 'Idioma',
	'common.confirm': 'OK',
	'common.cancel': 'Cancelar',
	'common.soon': 'Próximamente',
	'common.more': 'Más ›',
	'common.loading': 'Cargando…',
	'common.empty': 'Sin datos',
	'home.banner1': 'Descubrir proyectos',
	'home.banner2': 'Abrir oportunidades',
	'home.bannerSub1': 'Web3 · chat · colaboración',
	'home.bannerSub2': 'Plataforma',
	'home.publish': 'Publicar',
	'home.search': 'Buscar',
	'home.latest': 'Últimos',
	'home.hot': 'Proyectos populares',
	'home.viewMore': 'Ver más ›',
	'home.emptyNews': 'Sin novedades',
	'home.emptyProject': 'Sin proyectos',
	'home.friends': 'Enlaces',
	'notify.title1a': 'Noticias',
	'notify.title1b': '',
	'notify.title2a': 'y',
	'notify.title2b': 'Feed',
	'notify.empty': 'Sin noticias',
	'notify.loading': 'Cargando…',
	'notify.likes': ' me gusta',
	'profile.balance': 'Saldo USDT',
	'profile.fav': 'Favoritos',
	'profile.history': 'Historial',
	'profile.emptyRec': 'Sin registros',
	'profile.analytics': 'Análisis',
	'profile.chat': 'Negocios',
	'profile.share': 'Ingresos',
	'profile.service': 'Servicio',
	'profile.center': 'Funciones',
	'profile.myPublish': 'Mis publicaciones',
	'profile.follow': 'Siguiendo',
	'profile.invite': 'Invitar',
	'invite.title': 'Invitar amigos',
	'invite.desc': 'Comparte tu código de invitación',
	'invite.myCode': 'Mi código',
	'invite.scan': 'Escanear',
	'invite.searchUser': 'Buscar usuario',
	'invite.enterUser': 'Introducir nombre',
	'login.wallet': 'Login con wallet',
	'login.mail': 'Login con email',
	'login.register': 'Registrarse',
	'login.welcome': 'Bienvenido de nuevo',
	'login.create': 'Crear cuenta',
	'chat.title': 'Charlas',
	'chat.filterAll': 'Todo',
	'chat.filterRecent': 'Recientes',
	'chat.filterUnread': 'No leídos',
	'chat.reject': 'Rechazar',
	'chat.accept': 'Aceptar',
	'chat.answer': 'Contestar',
	'chat.inviteBanner': 'Tienes {n} invitación(es)',
	'chat.from': 'De: ',
	'chat.needLogin': 'Chat no iniciado',
	'chat.needLoginHint': 'Inicia sesión en Matrix para mensajería.',
	'chat.loginMatrix': 'Entrar al chat',
	'chat.empty': 'Sin conversaciones',
	'chat.emptyHint': 'Toca ＋ para crear o unirte',
	'chat.inviteMember': 'Invitar',
	'chat.deleteChat': 'Eliminar',
	'chat.pin': 'Fijar',
	'chat.unpin': 'Desfijar',
	'chat.mute': 'Silenciar',
	'chat.unmute': 'Activar',
	'chat.noMessage': 'Sin mensajes',
	'chat.yesterday': 'Ayer',
	'chat.send': 'Enviar',
	'chat.inputPh': 'Escribe un mensaje',
	'pub.title': 'Publicar proyecto',
	'pub.draft': 'Borrador',
	'pub.step1': 'Básicos',
	'pub.step2': 'Acerca de',
	'pub.step3': 'Archivos',
	'pub.step4': 'Enviar',
	'pub.name': 'Nombre del proyecto',
	'pub.namePh': 'Nombre (mín. 5)',
	'pub.category': 'Categoría',
	'pub.categoryPh': 'Seleccionar',
	'pub.intro': 'Resumen',
	'pub.introPh': 'Resumen (mín. 20)',
	'pub.logo': 'Logo',
	'pub.uploadLogo': 'Subir logo',
	'pub.uploadHint': 'jpg/png, máx. 2MB',
	'pub.cover': 'Portada',
	'pub.uploadCover': 'Subir portada',
	'pub.coverHint': 'Recomendado 1280×720',
	'pub.highlight': 'Destacados',
	'pub.highlightPh': 'Destacados (mín. 5)',
	'pub.audience': 'Usuarios objetivo',
	'pub.audiencePh': 'Describe el público',
	'pub.detail': 'Detalles',
	'pub.detailPh': 'Detalles (mín. 20)',
	'pub.material': 'Materiales',
	'pub.uploadMaterial': 'Subir',
	'pub.coverPreview': 'Vista previa',
	'pub.reviewTitle': 'Confirmar y enviar',
	'pub.reviewName': 'Nombre: ',
	'pub.reviewCat': 'Categoría: ',
	'pub.reviewIntro': 'Resumen: ',
	'pub.reviewHighlight': 'Destacados: ',
	'pub.next': 'Siguiente',
	'pub.prev': 'Atrás',
	'pub.submit': 'Enviar',
	'pub.submitting': 'Enviando…',
	'pub.visitorBlock': 'Los visitantes no pueden publicar. Suscríbete.',
	'api.visitor': 'Visitante',
	'api.normalUser': 'Gratis',
	'api.member': 'Miembro',
	'api.owner': 'Dueño del proyecto',
	'api.leader': 'Líder de comunidad',
	'api.subActive': 'Suscripción activa',
	'api.subNone': 'Sin suscripción',
	'api.subExpired': 'Suscripción vencida',
	'api.pendingPay': 'Pago pendiente',
	'api.periodRange': 'Válido: {s} – {e}',
	'api.periodUntil': 'Válido hasta {e}',
	'api.remainDays': '{n} días restantes',
	'api.goSubscribe': 'Suscribirse',
	'api.renew': 'Renovar',
	'api.catAll': 'Todo',
	'api.catFinance': 'Finanzas',
	'api.catLive': 'En vivo',
	'api.catWeb3': 'Web3',
	'api.catDefi': 'DeFi',
	'api.catProject': 'Proyectos',
	'api.catOther': 'Otro',
	'api.tagOriginal': 'Original',
	'api.tagFromX': 'De X',
	'api.memberSuffix': ' Miembro'
})

const ar = fromEn({
	'lang.title': 'اللغة',
	'common.confirm': 'موافق',
	'common.cancel': 'إلغاء',
	'common.soon': 'قريبًا',
	'common.more': 'المزيد ›',
	'common.loading': 'جارٍ التحميل…',
	'common.empty': 'لا بيانات',
	'home.banner1': 'اكتشف المشاريع',
	'home.banner2': 'افتح الفرص',
	'home.bannerSub1': 'Web3 · تواصل · تعاون',
	'home.bannerSub2': 'المنصة',
	'home.publish': 'نشر',
	'home.search': 'بحث',
	'home.latest': 'الأحدث',
	'home.hot': 'مشاريع رائجة',
	'home.viewMore': 'المزيد ›',
	'home.emptyNews': 'لا تحديثات',
	'home.emptyProject': 'لا مشاريع',
	'home.friends': 'روابط',
	'notify.title1a': 'أخبار',
	'notify.title1b': '',
	'notify.title2a': 'و',
	'notify.title2b': 'موجز',
	'notify.empty': 'لا أخبار',
	'notify.loading': 'جارٍ التحميل…',
	'notify.likes': ' إعجاب',
	'profile.balance': 'رصيد USDT',
	'profile.fav': 'المفضلة',
	'profile.history': 'السجل',
	'profile.emptyRec': 'لا سجلات',
	'profile.analytics': 'تحليلات',
	'profile.chat': 'مفاوضات أعمال',
	'profile.share': 'الإيرادات',
	'profile.service': 'الخدمة',
	'profile.center': 'الميزات',
	'profile.myPublish': 'منشوراتي',
	'profile.follow': 'المتابَعون',
	'profile.invite': 'دعوة',
	'invite.title': 'دعوة الأصدقاء',
	'invite.desc': 'شارك رمز الدعوة',
	'invite.myCode': 'رمزي',
	'invite.scan': 'مسح',
	'invite.searchUser': 'بحث عن مستخدم',
	'invite.enterUser': 'أدخل اسم المستخدم',
	'login.wallet': 'دخول المحفظة',
	'login.mail': 'دخول البريد',
	'login.register': 'تسجيل',
	'login.welcome': 'مرحبًا بعودتك',
	'login.create': 'إنشاء حساب',
	'chat.title': 'محادثات',
	'chat.filterAll': 'الكل',
	'chat.filterRecent': 'الأخيرة',
	'chat.filterUnread': 'غير مقروء',
	'chat.reject': 'رفض',
	'chat.accept': 'قبول',
	'chat.answer': 'رد',
	'chat.inviteBanner': 'لديك {n} دعوة',
	'chat.from': 'من: ',
	'chat.needLogin': 'الدردشة غير مسجّلة',
	'chat.needLoginHint': 'سجّل الدخول إلى Matrix للمراسلة.',
	'chat.loginMatrix': 'دخول الدردشة',
	'chat.empty': 'لا محادثات بعد',
	'chat.emptyHint': 'اضغط ＋ للبدء أو الانضمام',
	'chat.inviteMember': 'دعوة أعضاء',
	'chat.deleteChat': 'حذف',
	'chat.pin': 'تثبيت',
	'chat.unpin': 'إلغاء التثبيت',
	'chat.mute': 'كتم',
	'chat.unmute': 'إلغاء الكتم',
	'chat.noMessage': 'لا رسائل',
	'chat.yesterday': 'أمس',
	'chat.send': 'إرسال',
	'chat.inputPh': 'اكتب رسالة',
	'pub.title': 'نشر مشروع',
	'pub.draft': 'مسودة',
	'pub.step1': 'أساسيات',
	'pub.step2': 'حول',
	'pub.step3': 'ملفات',
	'pub.step4': 'إرسال',
	'pub.name': 'اسم المشروع',
	'pub.namePh': 'الاسم (5 على الأقل)',
	'pub.category': 'التصنيف',
	'pub.categoryPh': 'اختر',
	'pub.intro': 'ملخص',
	'pub.introPh': 'ملخص (20 على الأقل)',
	'pub.logo': 'الشعار',
	'pub.uploadLogo': 'رفع الشعار',
	'pub.uploadHint': 'jpg/png بحد أقصى 2MB',
	'pub.cover': 'الغلاف',
	'pub.uploadCover': 'رفع الغلاف',
	'pub.coverHint': 'موصى به 1280×720',
	'pub.highlight': 'أبرز النقاط',
	'pub.highlightPh': 'أبرز النقاط (5 على الأقل)',
	'pub.audience': 'المستخدمون المستهدفون',
	'pub.audiencePh': 'صف الجمهور',
	'pub.detail': 'التفاصيل',
	'pub.detailPh': 'التفاصيل (20 على الأقل)',
	'pub.material': 'مواد إضافية',
	'pub.uploadMaterial': 'رفع',
	'pub.coverPreview': 'معاينة الغلاف',
	'pub.reviewTitle': 'أكد ثم أرسل للمراجعة',
	'pub.reviewName': 'الاسم: ',
	'pub.reviewCat': 'التصنيف: ',
	'pub.reviewIntro': 'الملخص: ',
	'pub.reviewHighlight': 'أبرز النقاط: ',
	'pub.next': 'التالي',
	'pub.prev': 'رجوع',
	'pub.submit': 'إرسال',
	'pub.submitting': 'جارٍ الإرسال…',
	'pub.visitorBlock': 'الزوار لا يمكنهم النشر. يرجى الاشتراك.',
	'api.visitor': 'زائر',
	'api.normalUser': 'مجاني',
	'api.member': 'عضو',
	'api.owner': 'صاحب المشروع',
	'api.leader': 'قائد المجتمع',
	'api.subActive': 'اشتراك فعّال',
	'api.subNone': 'لا اشتراك',
	'api.subExpired': 'انتهى الاشتراك',
	'api.pendingPay': 'بانتظار الدفع',
	'api.periodRange': 'صالح: {s} – {e}',
	'api.periodUntil': 'صالح حتى {e}',
	'api.remainDays': 'متبقٍ {n} يومًا',
	'api.goSubscribe': 'اشترك',
	'api.renew': 'تجديد',
	'api.catAll': 'الكل',
	'api.catFinance': 'مالية',
	'api.catLive': 'مباشر',
	'api.catWeb3': 'Web3',
	'api.catDefi': 'DeFi',
	'api.catProject': 'مشاريع',
	'api.catOther': 'أخرى',
	'api.tagOriginal': 'أصلي',
	'api.tagFromX': 'من X',
	'api.memberSuffix': ' عضو'
})

const pt = fromEn({
	'lang.title': 'Idioma',
	'common.confirm': 'OK',
	'common.cancel': 'Cancelar',
	'common.soon': 'Em breve',
	'common.more': 'Mais ›',
	'common.loading': 'Carregando…',
	'common.empty': 'Sem dados',
	'home.banner1': 'Descobrir projetos',
	'home.banner2': 'Abrir oportunidades',
	'home.bannerSub1': 'Web3 · chat · colaboração',
	'home.bannerSub2': 'Plataforma',
	'home.publish': 'Publicar',
	'home.search': 'Pesquisar',
	'home.latest': 'Recentes',
	'home.hot': 'Projetos em alta',
	'home.viewMore': 'Ver mais ›',
	'home.emptyNews': 'Sem novidades',
	'home.emptyProject': 'Sem projetos',
	'home.friends': 'Links',
	'notify.title1a': 'Notícias',
	'notify.title1b': '',
	'notify.title2a': 'e',
	'notify.title2b': 'Feed',
	'notify.empty': 'Sem notícias',
	'notify.loading': 'Carregando…',
	'notify.likes': ' curtidas',
	'profile.balance': 'Saldo USDT',
	'profile.fav': 'Favoritos',
	'profile.history': 'Histórico',
	'profile.emptyRec': 'Sem registros',
	'profile.analytics': 'Análises',
	'profile.chat': 'Negócios',
	'profile.share': 'Receita',
	'profile.service': 'Serviço',
	'profile.center': 'Recursos',
	'profile.myPublish': 'Minhas posts',
	'profile.follow': 'Seguindo',
	'profile.invite': 'Convidar',
	'invite.title': 'Convidar amigos',
	'invite.desc': 'Compartilhe seu código de convite',
	'invite.myCode': 'Meu código',
	'invite.scan': 'Escanear',
	'invite.searchUser': 'Buscar usuário',
	'invite.enterUser': 'Digite o nome',
	'login.wallet': 'Login com carteira',
	'login.mail': 'Login com e-mail',
	'login.register': 'Cadastrar',
	'login.welcome': 'Bem-vindo de volta',
	'login.create': 'Criar conta',
	'chat.title': 'Conversas',
	'chat.filterAll': 'Todos',
	'chat.filterRecent': 'Recentes',
	'chat.filterUnread': 'Não lidos',
	'chat.reject': 'Recusar',
	'chat.accept': 'Aceitar',
	'chat.answer': 'Atender',
	'chat.inviteBanner': 'Você tem {n} convite(s)',
	'chat.from': 'De: ',
	'chat.needLogin': 'Chat não conectado',
	'chat.needLoginHint': 'Entre no Matrix para mensagens.',
	'chat.loginMatrix': 'Entrar no chat',
	'chat.empty': 'Sem conversas',
	'chat.emptyHint': 'Toque ＋ para criar ou entrar',
	'chat.inviteMember': 'Convidar',
	'chat.deleteChat': 'Excluir',
	'chat.pin': 'Fixar',
	'chat.unpin': 'Desafixar',
	'chat.mute': 'Silenciar',
	'chat.unmute': 'Ativar som',
	'chat.noMessage': 'Sem mensagens',
	'chat.yesterday': 'Ontem',
	'chat.send': 'Enviar',
	'chat.inputPh': 'Digite uma mensagem',
	'pub.title': 'Publicar projeto',
	'pub.draft': 'Rascunho',
	'pub.step1': 'Básico',
	'pub.step2': 'Sobre',
	'pub.step3': 'Arquivos',
	'pub.step4': 'Enviar',
	'pub.name': 'Nome do projeto',
	'pub.namePh': 'Nome (mín. 5)',
	'pub.category': 'Categoria',
	'pub.categoryPh': 'Selecionar',
	'pub.intro': 'Resumo',
	'pub.introPh': 'Resumo (mín. 20)',
	'pub.logo': 'Logo',
	'pub.uploadLogo': 'Enviar logo',
	'pub.uploadHint': 'jpg/png, máx. 2MB',
	'pub.cover': 'Capa',
	'pub.uploadCover': 'Enviar capa',
	'pub.coverHint': 'Recomendado 1280×720',
	'pub.highlight': 'Destaques',
	'pub.highlightPh': 'Destaques (mín. 5)',
	'pub.audience': 'Público-alvo',
	'pub.audiencePh': 'Descreva o público',
	'pub.detail': 'Detalhes',
	'pub.detailPh': 'Detalhes (mín. 20)',
	'pub.material': 'Materiais',
	'pub.uploadMaterial': 'Enviar',
	'pub.coverPreview': 'Prévia da capa',
	'pub.reviewTitle': 'Confirmar e enviar',
	'pub.reviewName': 'Nome: ',
	'pub.reviewCat': 'Categoria: ',
	'pub.reviewIntro': 'Resumo: ',
	'pub.reviewHighlight': 'Destaques: ',
	'pub.next': 'Próximo',
	'pub.prev': 'Voltar',
	'pub.submit': 'Enviar',
	'pub.submitting': 'Enviando…',
	'pub.visitorBlock': 'Visitantes não podem publicar. Assine.',
	'api.visitor': 'Visitante',
	'api.normalUser': 'Grátis',
	'api.member': 'Membro',
	'api.owner': 'Dono do projeto',
	'api.leader': 'Líder da comunidade',
	'api.subActive': 'Assinatura ativa',
	'api.subNone': 'Sem assinatura',
	'api.subExpired': 'Assinatura expirada',
	'api.pendingPay': 'Pagamento pendente',
	'api.periodRange': 'Válido: {s} – {e}',
	'api.periodUntil': 'Válido até {e}',
	'api.remainDays': '{n} dias restantes',
	'api.goSubscribe': 'Assinar',
	'api.renew': 'Renovar',
	'api.catAll': 'Todos',
	'api.catFinance': 'Finanças',
	'api.catLive': 'Ao vivo',
	'api.catWeb3': 'Web3',
	'api.catDefi': 'DeFi',
	'api.catProject': 'Projetos',
	'api.catOther': 'Outro',
	'api.tagOriginal': 'Original',
	'api.tagFromX': 'Do X',
	'api.memberSuffix': ' Membro'
})

const header = `/**
 * 轻量多语言（适配 uni-app x Android VDOM）
 * 与后台 think-lang 一致：
 * en / zh-cn / zh-tw / ja / ko / ru / vi
 */
const KEY_LOCALE = 'app_locale_v2'
const KEY_LOCALE_VER = 'app_locale_ver_v2'
const DEFAULT_LOCALE = 'en'

export type LocaleOption = {
	code: string
	label: string
}

export const LOCALE_OPTIONS: Array<LocaleOption> = [
	{ code: 'en', label: 'English' } as LocaleOption,
	{ code: 'zh-cn', label: '简体中文' } as LocaleOption,
	{ code: 'zh-tw', label: '繁體中文' } as LocaleOption,
	{ code: 'ja', label: '日本語' } as LocaleOption,
	{ code: 'ko', label: '한국어' } as LocaleOption,
	{ code: 'ru', label: 'Русский' } as LocaleOption,
	{ code: 'vi', label: 'Tiếng Việt' } as LocaleOption
]

function fillPack(m: Map<string, string>, pairs: Array<string>): void {
	for (let i = 0; i + 1 < pairs.length; i += 2) {
		m.set(pairs[i], pairs[i + 1])
	}
}

const MSG_ZH_CN = new Map<string, string>()
const MSG_ZH_TW = new Map<string, string>()
const MSG_EN = new Map<string, string>()
const MSG_JA = new Map<string, string>()
const MSG_KO = new Map<string, string>()
const MSG_RU = new Map<string, string>()
const MSG_VI = new Map<string, string>()

`

const footer = `
function packOf(locale: string): Map<string, string> {
	if (locale == 'en') return MSG_EN
	if (locale == 'zh-tw') return MSG_ZH_TW
	if (locale == 'ja') return MSG_JA
	if (locale == 'ko') return MSG_KO
	if (locale == 'ru') return MSG_RU
	if (locale == 'vi') return MSG_VI
	return MSG_ZH_CN
}

function normalizeLocale(code: string): string {
	const c = code.trim()
	if (c.length == 0) return DEFAULT_LOCALE
	for (let i = 0; i < LOCALE_OPTIONS.length; i++) {
		if (LOCALE_OPTIONS[i].code == c) return c
	}
	const lower = c.toLowerCase().replace('_', '-')
	// 兼容旧码与系统语言
	if (lower == 'zh-hans' || lower == 'zh-cn' || lower == 'zh') return 'zh-cn'
	if (lower == 'zh-hant' || lower == 'zh-tw' || lower == 'zh-hk') return 'zh-tw'
	if (lower.indexOf('zh') == 0) {
		if (lower.indexOf('hant') >= 0 || lower.indexOf('tw') >= 0 || lower.indexOf('hk') >= 0) return 'zh-tw'
		return 'zh-cn'
	}
	if (lower.indexOf('en') == 0) return 'en'
	if (lower.indexOf('ja') == 0) return 'ja'
	if (lower.indexOf('ko') == 0) return 'ko'
	if (lower.indexOf('ru') == 0) return 'ru'
	if (lower.indexOf('vi') == 0) return 'vi'
	if (lower.indexOf('fr') == 0 || lower.indexOf('de') == 0 || lower.indexOf('es') == 0 || lower.indexOf('ar') == 0 || lower.indexOf('pt') == 0) return 'en'
	return DEFAULT_LOCALE
}

export function getLocale(): string {
	try {
		const raw = uni.getStorageSync(KEY_LOCALE)
		if (raw != null) {
			const s = ('' + raw).trim()
			if (s.length > 0) return normalizeLocale(s)
		}
	} catch (e) {}
	// 未手动选过语言：固定英文，不跟系统语言
	return DEFAULT_LOCALE
}

export function getLocaleVersion(): number {
	try {
		const raw = uni.getStorageSync(KEY_LOCALE_VER)
		if (raw == null) return 0
		const n = parseInt('' + raw)
		if (n == n) return n
	} catch (e) {}
	return 0
}

export function setLocale(code: string): void {
	const loc = normalizeLocale(code)
	try { uni.setStorageSync(KEY_LOCALE, loc) } catch (e) {}
	try { uni.setStorageSync(KEY_LOCALE_VER, '' + Date.now()) } catch (e2) {}
}

export function getLocaleLabel(code: string = ''): string {
	const loc = code.length > 0 ? normalizeLocale(code) : getLocale()
	for (let i = 0; i < LOCALE_OPTIONS.length; i++) {
		if (LOCALE_OPTIONS[i].code == loc) return LOCALE_OPTIONS[i].label
	}
	return '简体中文'
}

export function t(key: string): string {
	const loc = getLocale()
	const pack = packOf(loc)
	const hit = pack.get(key)
	if (hit != null) return hit
	if (loc != DEFAULT_LOCALE) {
		const hit2 = MSG_ZH_CN.get(key)
		if (hit2 != null) return hit2
	}
	return key
}

/**
 * 接口多语言请求头 think-lang（与后台约定一致）
 * 例：think-lang: en
 */
export function getThinkLang(): string {
	return getLocale()
}

function replaceAllToken(src: string, token: string, value: string): string {
	let out = src
	while (out.indexOf(token) >= 0) {
		const i = out.indexOf(token)
		out = out.substring(0, i) + value + out.substring(i + token.length)
	}
	return out
}

/**
 * 翻译接口/后台返回的固定中文枚举与状态文案。
 * 资讯标题、正文等自由文本无词典时原样返回（需后台多语言或翻译服务）。
 */
export function tx(raw: string): string {
	const s = raw.trim()
	if (s.length == 0) return s
	if (s == '游客' || s.toUpperCase() == 'VISITOR') return t('api.visitor')
	if (s == '普通用户') return t('api.normalUser')
	if (s == '会员') return t('api.member')
	if (s == '项目方') return t('api.owner')
	if (s == '社区长') return t('api.leader')
	if (s == '订阅有效') return t('api.subActive')
	if (s == '暂无有效订阅') return t('api.subNone')
	if (s == '订阅已过期') return t('api.subExpired')
	if (s == '待支付') return t('api.pendingPay')
	if (s == '全部') return t('api.catAll')
	if (s == '金融') return t('api.catFinance')
	if (s == '直播') return t('api.catLive')
	if (s == 'Web3' || s == 'Web3.0') return t('api.catWeb3')
	if (s == 'DeFi' || s == 'Defi' || s == 'defi') return t('api.catDefi')
	if (s == '项目') return t('api.catProject')
	if (s == '其他') return t('api.catOther')
	if (s == '原创') return t('api.tagOriginal')
	if (s == '摘自于X') return t('api.tagFromX')
	if (s == '去订阅') return t('api.goSubscribe')
	if (s == '续费') return t('api.renew')

	if (s.indexOf('有效期：') == 0) {
		const rest = s.substring(4)
		const sep = ' 至 '
		const idx = rest.indexOf(sep)
		if (idx >= 0) {
			const a = rest.substring(0, idx)
			const b = rest.substring(idx + sep.length)
			return replaceAllToken(replaceAllToken(t('api.periodRange'), '{s}', a), '{e}', b)
		}
	}
	if (s.indexOf('有效期至：') == 0) {
		return replaceAllToken(t('api.periodUntil'), '{e}', s.substring(5))
	}
	if (s.indexOf('剩余 ') == 0 && s.indexOf(' 天') == s.length - 2) {
		const n = s.substring(3, s.length - 2).trim()
		return replaceAllToken(t('api.remainDays'), '{n}', n)
	}
	if (s.length > 2 && s.substring(s.length - 2) == '会员') {
		const prefix = s.substring(0, s.length - 2)
		if (prefix == '项目方' || prefix == '社区长') return tx(prefix)
		return prefix + t('api.memberSuffix')
	}
	return s
}

export function openLanguagePage(): void {
	uni.navigateTo({ url: '/pages/settings/language' })
}

/** 选语言后回到首页并重建界面，确保文案生效 */
export function applyLocaleAndReload(code: string): void {
	setLocale(code)
	uni.reLaunch({ url: '/pages/home/home' })
}
`

function flat(pairs) {
	const out = []
	for (const [k, v] of pairs) {
		out.push(k, v)
	}
	return out
}

function emit(varName, pairs) {
	const lines = []
	for (let i = 0; i < pairs.length; i++) {
		const [k, v] = pairs[i]
		const comma = i + 1 < pairs.length ? ',' : ''
		lines.push(`\t'${esc(k)}', '${esc(v)}'${comma}`)
	}
	return `fillPack(${varName}, [\n${lines.join('\n')}\n])`
}

const out =
	header +
	emit('MSG_ZH_CN', zhPatched) + '\n' +
	emit('MSG_ZH_TW', twPatched) + '\n' +
	emit('MSG_EN', enPatched) + '\n' +
	emit('MSG_JA', jaPatched) + '\n' +
	emit('MSG_KO', koPatched) + '\n' +
	emit('MSG_FR', fr) + '\n' +
	emit('MSG_DE', de) + '\n' +
	emit('MSG_ES', es) + '\n' +
	emit('MSG_RU', ruPatched) + '\n' +
	emit('MSG_AR', ar) + '\n' +
	emit('MSG_PT', pt) + '\n' +
	footer

fs.writeFileSync(path, out, 'utf8')
console.log('wrote', path, 'bytes', out.length)
console.log('locales', ['zh-cn','en','zh-tw','ja','ko','fr','de','es','ru','ar','pt'].join(','))
console.log('zh title', zhPatched.find(p => p[0]==='chat.title')[1])
console.log('keys', zhPatched.length)
