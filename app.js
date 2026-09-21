/* דף קשר לגן — demo build.
   Storage is behind a Store adapter: LocalStore (localStorage) now,
   an AWS API adapter (Amplify -> API Gateway -> DynamoDB + S3) plugs in later
   without touching the views. See README "Architecture". */
(function () {
  'use strict';

  /* ================= Store adapter ================= */
  var LocalStore = {
    _read: function (key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
    },
    _write: function (key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    listGroups: function () { return this._read('kcs_groups', []); },
    createGroup: function (title, subtitle) {
      var groups = this.listGroups();
      var g = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: title, subtitle: subtitle, createdAt: Date.now() };
      groups.push(g);
      this._write('kcs_groups', groups);
      return g;
    },
    getGroup: function (id) {
      return this.listGroups().find(function (g) { return g.id === id; }) || null;
    },
    listSubmissions: function (groupId) { return this._read('kcs_subs_' + groupId, []); },
    addSubmission: function (groupId, sub) {
      var subs = this.listSubmissions(groupId);
      sub.id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      sub.submittedAt = Date.now();
      subs.push(sub);
      this._write('kcs_subs_' + groupId, subs);
      return sub;
    },
    deleteSubmission: function (groupId, subId) {
      var subs = this.listSubmissions(groupId).filter(function (s) { return s.id !== subId; });
      this._write('kcs_subs_' + groupId, subs);
    },
    replaceSubmissions: function (groupId, subs) {
      subs.forEach(function (s, i) { s.id = 'seed' + i; s.submittedAt = Date.now(); });
      this._write('kcs_subs_' + groupId, subs);
    }
  };
  var Store = LocalStore; // future: AwsStore with the same interface

  /* ================= helpers ================= */
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function initials(s) {
    return ((s.childFirst || '').charAt(0) + (s.childLast || '').charAt(0));
  }

  /* ================= router ================= */
  var views = { landing: $('view-landing'), admin: $('view-admin'), form: $('view-form') };
  var currentGroupId = null;

  function route() {
    var h = location.hash || '#/';
    var m;
    if ((m = h.match(/^#\/admin\/(.+)$/))) return showAdmin(m[1]);
    if ((m = h.match(/^#\/form\/(.+)$/))) return showForm(m[1]);
    return showLanding();
  }
  function switchView(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    $('sheetSection').hidden = name !== 'admin';
    window.scrollTo(0, 0);
  }

  /* ================= landing ================= */
  function showLanding() {
    switchView('landing');
    var groups = Store.listGroups();
    var box = $('existingGroups');
    var ul = $('groupList');
    ul.innerHTML = '';
    box.hidden = !groups.length;
    groups.forEach(function (g) {
      var li = document.createElement('li');
      li.innerHTML = '<a href="#/admin/' + g.id + '">' + esc(g.title) + '</a> <span class="muted">(' + Store.listSubmissions(g.id).length + ' טפסים)</span>';
      ul.appendChild(li);
    });
  }

  $('createGroupForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var title = $('newGroupTitle').value.trim();
    if (!title) return;
    var g = Store.createGroup(title, $('newGroupSubtitle').value.trim());
    this.reset();
    location.hash = '#/admin/' + g.id;
  });

  $('demoTourBtn').addEventListener('click', function () {
    var g = Store.createGroup('גן רימון — תשפ"ז (דוגמה)', 'הגננת דנה והצוות');
    Store.replaceSubmissions(g.id, syntheticSubs());
    location.hash = '#/admin/' + g.id;
  });

  /* ================= admin ================= */
  function showAdmin(groupId) {
    var g = Store.getGroup(groupId);
    if (!g) { location.hash = '#/'; return; }
    currentGroupId = groupId;
    switchView('admin');
    $('adminGroupName').textContent = g.title;
    var link = location.origin + location.pathname + '#/form/' + groupId;
    $('shareLink').value = link;
    $('openFormLink').href = link;
    renderAdmin();
  }

  $('copyLinkBtn').addEventListener('click', function () {
    var input = $('shareLink');
    input.select();
    var done = function () {
      $('copyLinkBtn').textContent = 'הועתק ✓';
      setTimeout(function () { $('copyLinkBtn').textContent = 'העתקה'; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).then(done, function () { document.execCommand('copy'); done(); });
    } else { document.execCommand('copy'); done(); }
  });

  $('seedBtn').addEventListener('click', function () {
    var subs = Store.listSubmissions(currentGroupId);
    if (subs.length && !window.confirm('טעינת נתוני דוגמה תחליף את הטפסים הקיימים. להמשיך?')) return;
    Store.replaceSubmissions(currentGroupId, syntheticSubs());
    renderAdmin();
  });

  $('clearSubsBtn').addEventListener('click', function () {
    if (window.confirm('למחוק את כל הטפסים בקבוצה?')) {
      Store.replaceSubmissions(currentGroupId, []);
      renderAdmin();
    }
  });

  $('printBtn').addEventListener('click', function () { window.print(); });

  function renderAdmin() {
    var subs = Store.listSubmissions(currentGroupId);
    $('subCount').textContent = subs.length;
    $('clearSubsBtn').hidden = !subs.length;
    $('subsTable').hidden = !subs.length;
    $('subsEmpty').style.display = subs.length ? 'none' : '';
    var body = $('subsBody');
    body.innerHTML = '';
    subs.forEach(function (s) {
      var tr = document.createElement('tr');
      var thumb = s.photo
        ? '<img class="thumb" src="' + s.photo + '" alt="">'
        : '<div class="thumb">' + esc(initials(s)) + '</div>';
      tr.innerHTML =
        '<td>' + thumb + '</td>' +
        '<td><strong>' + esc(s.childFirst) + ' ' + esc(s.childLast) + '</strong></td>' +
        '<td>' + esc(s.address || '—') + '</td>' +
        '<td>' + esc(s.p1Name || '') + '<br><span class="phone">' + esc(s.p1Phone || '') + '</span></td>' +
        '<td>' + esc(s.p2Name || '—') + (s.p2Phone ? '<br><span class="phone">' + esc(s.p2Phone) + '</span>' : '') + '</td>' +
        '<td><button type="button" title="מחיקה">🗑️</button></td>';
      tr.querySelector('button').addEventListener('click', function () {
        Store.deleteSubmission(currentGroupId, s.id);
        renderAdmin();
      });
      body.appendChild(tr);
    });
    renderSheet();
  }

  /* ================= parent form ================= */
  var pendingPhoto = null;

  function showForm(groupId) {
    var g = Store.getGroup(groupId);
    if (!g) { location.hash = '#/'; return; }
    currentGroupId = groupId;
    switchView('form');
    $('formGroupName').textContent = g.title;
    $('formGroupSub').textContent = g.subtitle || '';
    $('parentForm').hidden = false;
    $('formThanks').hidden = true;
  }

  $('photoInput').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var max = 400;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        pendingPhoto = canvas.toDataURL('image/jpeg', 0.85);
        renderFormPhoto();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  $('clearPhoto').addEventListener('click', function () {
    pendingPhoto = null;
    $('photoInput').value = '';
    renderFormPhoto();
  });

  function renderFormPhoto() {
    $('photoPreview').innerHTML = pendingPhoto ? '<img src="' + pendingPhoto + '" alt="">' : '<span>📷</span>';
    $('clearPhoto').hidden = !pendingPhoto;
  }

  $('parentForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    Store.addSubmission(currentGroupId, {
      childFirst: $('childFirst').value.trim(),
      childLast: $('childLast').value.trim(),
      address: $('childAddress').value.trim(),
      photo: pendingPhoto,
      p1Name: $('p1Name').value.trim(),
      p1Phone: $('p1Phone').value.trim(),
      p2Name: $('p2Name').value.trim(),
      p2Phone: $('p2Phone').value.trim()
    });
    this.reset();
    pendingPhoto = null;
    renderFormPhoto();
    this.hidden = true;
    $('formThanks').hidden = false;
  });

  $('fillAnotherBtn').addEventListener('click', function () {
    $('formThanks').hidden = true;
    $('parentForm').hidden = false;
  });

  /* ================= A4 sheet ================= */
  function renderSheet() {
    var g = Store.getGroup(currentGroupId);
    var subs = Store.listSubmissions(currentGroupId);
    $('sheetTitle').textContent = (g && g.title) || 'דף קשר';
    $('sheetSubtitle').textContent = (g && g.subtitle) || '';
    var grid = $('sheetGrid');
    grid.querySelectorAll('.kid-card').forEach(function (n) { n.remove(); });
    $('sheetEmpty').style.display = subs.length ? 'none' : '';
    subs.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'kid-card';
      var face = s.photo
        ? '<div class="face"><img src="' + s.photo + '" alt=""></div>'
        : '<div class="face">' + esc(initials(s)) + '</div>';
      var lines = '';
      lines += parentLine(s.p1Name, s.p1Phone);
      if (s.p2Name || s.p2Phone) lines += parentLine(s.p2Name, s.p2Phone);
      card.innerHTML = face +
        '<div class="kid-name">' + esc(s.childFirst) + ' ' + esc(s.childLast) + '</div>' +
        (s.address ? '<div class="kid-addr">' + esc(s.address) + '</div>' : '') +
        lines;
      grid.appendChild(card);
    });
  }
  function parentLine(name, phone) {
    if (!name && !phone) return '';
    var n = name ? '<span class="pname">' + esc(name) + '</span> ' : '';
    var p = phone ? '<span class="pphone">' + esc(phone) + '</span>' : '';
    return '<div class="parent-line">' + n + p + '</div>';
  }

  /* ================= synthetic demo data ================= */
  function syntheticSubs() {
    return [
      { childFirst: 'נועה', childLast: 'כהן', address: 'הרקפת 12, רמת גן', photo: null, p1Name: 'מיכל (אמא)', p1Phone: '050-111-2233', p2Name: 'תומר (אבא)', p2Phone: '052-444-5566' },
      { childFirst: 'יונתן', childLast: 'לוי', address: 'הדקל 4, גבעתיים', photo: null, p1Name: 'שירה (אמא)', p1Phone: '054-777-8899', p2Name: '', p2Phone: '' },
      { childFirst: 'מאיה', childLast: 'אברהם', address: 'התמרים 8, רמת גן', photo: null, p1Name: 'דוד (אבא)', p1Phone: '053-222-3344', p2Name: 'הילה (אמא)', p2Phone: '058-555-6677' },
      { childFirst: 'איתמר', childLast: 'שפירא', address: 'האלון 21, גבעתיים', photo: null, p1Name: 'רונית (אמא)', p1Phone: '050-888-9900', p2Name: '', p2Phone: '' },
      { childFirst: 'תהל', childLast: 'ברוך', address: 'הזית 3, רמת גן', photo: null, p1Name: 'ענת (אמא)', p1Phone: '052-101-2020', p2Name: 'עומר (אבא)', p2Phone: '054-303-4040' },
      { childFirst: 'אורי', childLast: 'גולן', address: 'הערבה 17, גבעתיים', photo: null, p1Name: 'ניר (אבא)', p1Phone: '053-606-7070', p2Name: '', p2Phone: '' }
    ];
  }

  window.addEventListener('hashchange', route);
  route();
})();
