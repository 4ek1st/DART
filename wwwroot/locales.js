// English is the canonical message. Russian aliases keep existing saved tab
// names and server messages readable without changing catalog data or tag IDs.
(function(root) {
  const rows = `
Home|Главная|Startseite
Settings|Настройки|Einstellungen
Language|Язык|Sprache
Interface language|Язык интерфейса|Sprache der Benutzeroberfläche
Choose the interface language. Artwork titles, artist names and search tags stay in their original language.|Выберите язык интерфейса. Названия работ, имена авторов и поисковые теги остаются на языке источника.|Wählen Sie die Sprache der Benutzeroberfläche. Werktitel, Künstlernamen und Such-Tags bleiben in der Originalsprache.
Your choice is saved in this profile and takes effect immediately.|Выбор сохраняется в этом профиле и применяется сразу.|Ihre Auswahl wird in diesem Profil gespeichert und sofort übernommen.
English is the default language.|Английский — язык по умолчанию.|Englisch ist die Standardsprache.
Illustrations|Иллюстрации|Illustrationen
NSFW illustrations|NSFW иллюстрации|NSFW-Illustrationen
NSFW illustrations|18+ иллюстрации|NSFW-Illustrationen
Recommendations|Рекомендации|Empfehlungen
Following|Подписки|Abonnements
Bookmarks|Закладки|Lesezeichen
Liked|Понравившиеся|Gefällt mir
Like|Нравится|Gefällt mir markieren
Unlike|Убрать лайк|Gefällt mir entfernen
Remove bookmark|Убрать закладку|Lesezeichen entfernen
Likes help tailor recommendations to your taste.|Лайки помогают подбирать рекомендации по вашему вкусу.|Gefällt-mir-Markierungen passen Empfehlungen an Ihren Geschmack an.
Use the heart to save a work here.|Поставьте лайк сердечком, чтобы сохранить работу здесь.|Markieren Sie ein Werk mit dem Herz, um es hier zu speichern.
Use the bookmark icon to return to a work later.|Нажмите значок закладки на работе, чтобы вернуться к ней позже.|Setzen Sie ein Lesezeichen, um später zu einem Werk zurückzukehren.
No works here yet.|Здесь пока нет работ.|Hier sind noch keine Werke.
Added to liked works|Добавлено в понравившиеся|Zu Gefällt mir hinzugefügt
Like removed|Лайк удалён|Gefällt-mir-Markierung entfernt
Failed to read liked works|Не удалось прочитать лайки|Gefällt-mir-Werke konnten nicht gelesen werden
Failed to change like|Не удалось изменить лайк|Gefällt-mir-Markierung konnte nicht geändert werden
Recently opened|Недавно открытое|Zuletzt geöffnet
Sources and settings|Источники и настройки|Quellen und Einstellungen
Content|Контент|Inhalte
AI and excluded tags|AI и исключённые теги|KI und ausgeschlossene Tags
Creators|Авторы|Urheber
Creator, source and uploader|Автор, источник и загрузчик|Urheber, Quelle und Uploader
Sources|Источники|Quellen
Connections and keys|Подключения и ключи|Verbindungen und Schlüssel
Tabs|Вкладки|Tabs
Browsing and pinning|Просмотр и закрепление|Ansehen und Anheften
Version and installation|Версия и установка|Version und Installation
Updates|Обновления|Updates
AI images|AI изображения|KI-Bilder
Choose which works to show in search, recommendations, profiles, related works, liked works and bookmarks. Saved works are kept.|Выберите, какие работы показывать в поиске, рекомендациях, профилях, похожих работах, понравившихся и закладках. Сохранённые работы остаются на месте.|Wählen Sie, welche Werke in Suche, Empfehlungen, Profilen, ähnlichen Werken, Gefällt mir und Lesezeichen erscheinen. Gespeicherte Werke bleiben erhalten.
Hide AI-generated|Скрывать AI-generated|KI-generierte Werke ausblenden
Works tagged as AI-generated or made with known generators.|Работы с метками AI генерации и известных генераторов.|Werke mit Tags für KI-Generierung oder bekannte Generatoren.
Also hide AI-assisted|Скрывать также AI-assisted|Auch KI-unterstützte Werke ausblenden
When disabled, works created with AI assistance remain visible.|Если выключено, работы с участием AI остаются видимыми.|Wenn deaktiviert, bleiben KI-unterstützte Werke sichtbar.
Recognizes tags such as #ai_generated, #ai-created, #ai_art, #stable_diffusion, #novelai and #ai-assisted. Works without these tags are not automatically classified as AI.|Учитываются метки вроде #ai_generated, #ai-created, #ai_art, #stable_diffusion, #novelai и #ai-assisted. Работа без такой метки не определяется автоматически как AI.|Berücksichtigt Tags wie #ai_generated, #ai-created, #ai_art, #stable_diffusion, #novelai und #ai-assisted. Werke ohne diese Tags werden nicht automatisch als KI-Inhalte eingestuft.
Previously viewed|Уже просмотренное|Bereits angesehen
Optionally hide familiar works from illustrations, recommendations and related works. Liked works, bookmarks and browsing history remain available in their own tabs.|По желанию убирайте знакомые работы из иллюстраций, рекомендаций и раздела «Похожие работы». Понравившиеся, закладки и история просмотра останутся доступны в своих вкладках.|Blenden Sie auf Wunsch bekannte Werke in Illustrationen, Empfehlungen und ähnlichen Werken aus. Gefällt-mir-Werke, Lesezeichen und Verlauf bleiben in ihren eigenen Tabs verfügbar.
Hide viewed and saved works|Скрывать просмотренные и сохранённые работы|Angesehene und gespeicherte Werke ausblenden
Includes grouped copies of a work from different sources. Disabled by default.|Учитываются также объединённые копии одной работы из разных источников. Изначально выключено.|Berücksichtigt auch zusammengefasste Kopien aus verschiedenen Quellen. Standardmäßig deaktiviert.
Excluded tags|Исключённые теги|Ausgeschlossene Tags
Works with these tags are hidden from the catalog. Matches are exact: #latex does not hide #latex_gloves.|Работы с указанными тегами не появятся в каталоге. Совпадение точное: #latex не скрывает #latex_gloves.|Werke mit diesen Tags werden ausgeblendet. Nur exakte Treffer zählen: #latex blendet #latex_gloves nicht aus.
Add excluded tags|Добавить исключённые теги|Ausgeschlossene Tags hinzufügen
For example, 3d, ai_generated_background|Например, 3d, ai_generated_background|Zum Beispiel 3d, ai_generated_background
The list is empty. You can enter several tags separated by commas.|Список пуст. Можно ввести несколько тегов через запятую.|Die Liste ist leer. Sie können mehrere durch Kommas getrennte Tags eingeben.
Checks every tag of grouped works from Danbooru, Gelbooru, Rule34 and Sankaku.|Фильтр проверяет все теги объединённой работы из Danbooru, Gelbooru, Rule34 и Sankaku.|Prüft alle Tags zusammengefasster Werke aus Danbooru, Gelbooru, Rule34 und Sankaku.
Filters and connections are stored on this computer.|Фильтры и подключения хранятся на этом компьютере.|Filter und Verbindungen werden auf diesem Computer gespeichert.
Who to show first|Кого показывать первым|Wen zuerst anzeigen
Artist / Creator|Художник / автор|Künstler / Urheber
Artist|Художник|Künstler
Creator|Автор|Urheber
Contributor|Участник|Mitwirkende Person
Uploader / Reposter|Загрузчик / репостер|Uploader / Reposter
Uploader|Загрузчик|Uploader
Original source|Исходная площадка|Originalquelle
Original link|Исходная ссылка|Originallink
Original|Оригинал|Original
The artist, original publication site or uploader can appear first on cards and artwork pages. All known credits remain listed separately on the artwork page.|На карточке и в шапке работы можно первым показать художника, сайт оригинальной публикации или загрузчика. На странице работы все известные данные остаются видимыми отдельно.|Auf Karten und Werkseiten können Künstler, Originalplattform oder Uploader zuerst erscheinen. Alle bekannten Angaben bleiben auf der Werkseite separat sichtbar.
Uses the artist category tag. If the artist is unknown, this is stated clearly.|По тегу категории artist. Если художник неизвестен, так и будет написано.|Verwendet Tags der Kategorie artist. Ist der Künstler unbekannt, wird dies angegeben.
The address supplied in the source field. It may link to the work rather than the artist's profile.|Адрес, который площадка указала в поле source. Он может вести на саму работу, а не на профиль автора.|Die Adresse im Feld source. Sie kann zum Werk statt zum Künstlerprofil führen.
The account that uploaded the post to Danbooru, Gelbooru or Rule34.|Аккаунт человека, загрузившего запись на Danbooru, Gelbooru или Rule34.|Das Konto, das den Beitrag auf Danbooru, Gelbooru oder Rule34 hochgeladen hat.
Danbooru is available without a key. Gelbooru and Rule34 require your user ID and API key.|Danbooru доступен без ключа. Gelbooru и Rule34 требуют ваши user ID и API key.|Danbooru ist ohne Schlüssel verfügbar. Gelbooru und Rule34 benötigen Ihre User-ID und Ihren API-Schlüssel.
Found in your Gelbooru account settings.|Указан в настройках вашего аккаунта Gelbooru.|In Ihren Gelbooru-Kontoeinstellungen zu finden.
The key is encrypted by Windows and stored in your profile. Leave it blank to keep the existing key.|Ключ шифруется средствами Windows и сохраняется в профиле текущего пользователя. Пустое поле ключа сохраняет уже введённый ключ.|Der Schlüssel wird durch Windows verschlüsselt und im Profil gespeichert. Ein leeres Feld behält den bisherigen Schlüssel bei.
To remove a key, clear User ID and click Save.|Чтобы удалить ключ, очистите User ID и нажмите «Сохранить».|Um einen Schlüssel zu entfernen, leeren Sie die User-ID und klicken Sie auf Speichern.
Your numeric Rule34 user ID.|Ваш числовой ID на Rule34.|Ihre numerische Rule34-User-ID.
Get a key in your Rule34 account settings. It is stored locally with Windows encryption.|Получите ключ в настройках аккаунта Rule34. Он хранится локально с шифрованием Windows.|Holen Sie den Schlüssel in Ihren Rule34-Kontoeinstellungen. Er wird lokal durch Windows verschlüsselt gespeichert.
Leave the field blank to keep the existing key. To delete it, clear User ID and save.|Пустое поле сохраняет прежний ключ. Чтобы удалить его, очистите User ID и сохраните.|Ein leeres Feld behält den bisherigen Schlüssel. Zum Löschen leeren Sie die User-ID und speichern Sie.
Sankaku account|Аккаунт Sankaku|Sankaku-Konto
Public works are available without signing in. Sign in for restricted works and advanced search. Available features depend on your Sankaku account.|Открытые работы доступны без входа. Для ограниченных работ и расширенного поиска авторизуйтесь. Доступные функции зависят от аккаунта Sankaku.|Öffentliche Werke sind ohne Anmeldung verfügbar. Melden Sie sich für eingeschränkte Werke und erweiterte Suche an. Verfügbare Funktionen hängen von Ihrem Sankaku-Konto ab.
Signed in:|Вход выполнен:|Angemeldet:
Sign out of Sankaku|Выйти из Sankaku|Bei Sankaku abmelden
Sign in to Sankaku|Войти в Sankaku|Bei Sankaku anmelden
Signing in…|Входим…|Anmeldung läuft…
Username or email|Логин или email|Benutzername oder E-Mail
Password|Пароль|Passwort
The password is not saved. The sign-in token is encrypted by Windows and restored after restart. Two-factor sign-in is not yet supported.|Пароль не сохраняется. Токен входа хранится с шифрованием Windows и восстанавливается после перезапуска. Вход с двухэтапной проверкой пока не поддерживается.|Das Passwort wird nicht gespeichert. Das Anmeldetoken wird durch Windows verschlüsselt und nach einem Neustart wiederhergestellt. Zwei-Faktor-Anmeldung wird noch nicht unterstützt.
How to open works|Как открывать работы|Werke öffnen
One temporary preview tab|Одна временная вкладка просмотра|Ein temporärer Vorschau-Tab
The next work replaces the preview tab. Back returns to the previous work and your position in the feed.|Следующий арт заменяет временную вкладку. «Назад» возвращает предыдущую работу и место в выдаче.|Das nächste Werk ersetzt die Vorschau. Zurück öffnet das vorherige Werk an der bisherigen Position.
Each work in a separate tab|Каждая работа в отдельной вкладке|Jedes Werk in einem eigenen Tab
Opened works stay in the tab bar until closed.|Открытые работы остаются в верхней строке до закрытия.|Geöffnete Werke bleiben bis zum Schließen in der Tableiste.
Ctrl + click or middle-click opens a work in a separate background tab. Ctrl + Shift + click switches to it immediately.|Ctrl + клик или средняя кнопка мыши открывает работу в отдельной фоновой вкладке. Ctrl + Shift + клик сразу переключает на неё.|Strg + Klick oder Mittelklick öffnet ein Werk in einem eigenen Hintergrund-Tab. Strg + Umschalt + Klick wechselt sofort dorthin.
Double-click a preview tab or use its pin button to keep it open. Pinned tabs are protected from Close others and Close tabs to the right.|Двойной клик по временной вкладке или значок закрепления оставляет её открытой. Закреплённые вкладки защищены от команд «Закрыть остальные» и «Закрыть справа».|Doppelklicken Sie auf einen Vorschau-Tab oder heften Sie ihn an, um ihn offen zu halten. Angeheftete Tabs bleiben bei Andere schließen und Tabs rechts schließen erhalten.
Manage tabs|Управление вкладками|Tabs verwalten
The list button beside + shows all tabs with full titles and search. The right-click menu helps close multiple tabs.|Кнопка списка рядом с «+» показывает все вкладки с полными названиями и поиском. Меню по правому клику помогает закрывать несколько вкладок.|Die Listen-Schaltfläche neben + zeigt alle Tabs mit vollständigen Titeln und Suche. Über das Kontextmenü können Sie mehrere Tabs schließen.
DART updates|Обновления DART|DART-Updates
Updates verify signatures and files. Bookmarks, subscriptions and settings stay in your profile.|Обновление проверяет подпись и файлы. Закладки, подписки и настройки остаются в вашем профиле.|Updates prüfen Signaturen und Dateien. Lesezeichen, Abonnements und Einstellungen bleiben in Ihrem Profil.
GitHub repository|Репозиторий GitHub|GitHub-Repository
Token for a private repository|Токен для закрытого репозитория|Token für ein privates Repository
Not needed for a public repository|Не нужен для публичного репозитория|Für ein öffentliches Repository nicht erforderlich
Check for updates|Проверить обновления|Nach Updates suchen
Install and restart|Установить и перезапустить|Installieren und neu starten
Install update|Установить обновление|Update installieren
The latest verified version is installed.|Установлена последняя проверенная версия.|Die neueste verifizierte Version ist installiert.
Downloading and verifying the update…|Скачиваем и проверяем обновление…|Update wird heruntergeladen und geprüft…
Update failed.|Не удалось выполнить обновление.|Update fehlgeschlagen.
Specify a GitHub repository to receive updates.|Укажите репозиторий GitHub для получения обновлений.|Geben Sie ein GitHub-Repository für Updates an.
Settings sections|Разделы настроек|Einstellungsbereiche
Search|Поиск|Suche
Search images and posts|Поиск изображений и публикаций|Bilder und Beiträge suchen
Search images and posts · Ctrl+K|Поиск изображений и публикаций · Ctrl+K|Bilder und Beiträge suchen · Strg+K
Find|Найти|Suchen
Menu|Меню|Menü
Navigation|Навигация|Navigation
Back|Назад|Zurück
Forward|Вперёд|Vorwärts
New tab|Новая вкладка|Neuer Tab
Tab|Вкладка|Tab
Open tabs|Открытые вкладки|Offene Tabs
All tabs|Все вкладки|Alle Tabs
No tabs found|Вкладки не найдены|Keine Tabs gefunden
Close|Закрыть|Schließen
Close tab|Закрыть вкладку|Tab schließen
Close window|Закрыть окно|Fenster schließen
Close others|Закрыть остальные|Andere schließen
Close tabs to the right|Закрыть справа|Tabs rechts schließen
Clear all|Очистить всё|Alle schließen
Pin tab|Закрепить вкладку|Tab anheften
Unpin tab|Открепить вкладку|Tab lösen
Pinned|Закреплена|Angeheftet
Temporary preview|Временный просмотр|Temporäre Vorschau
Minimize|Свернуть|Minimieren
Maximize|Развернуть|Maximieren
Restore|Восстановить|Wiederherstellen
Window controls|Управление окном|Fenstersteuerung
For you|Для вас|Für Sie
Favorite tags|Избранные теги|Lieblings-Tags
Favorite tags appear here. Search for one tag and click ☆ beside its name.|Избранные теги появятся здесь. Найдите один тег и нажмите ☆ рядом с его названием.|Lieblings-Tags erscheinen hier. Suchen Sie nach einem Tag und klicken Sie auf ☆ neben seinem Namen.
SFW|Обычные|SFW
Normal mode|Обычный режим|Normaler Modus
All images|Все изображения|Alle Bilder
All|Все|Alle
New|Новое|Neu
Newest|Новые|Neueste
Popular|Популярные|Beliebt
Newest first|Сначала новые|Neueste zuerst
Danbooru, Gelbooru and Rule34 use all-time scores. Sankaku uses its official popularity order.|Danbooru, Gelbooru и Rule34 — по оценкам за всё время. Sankaku — официальный порядок популярности сайта.|Danbooru, Gelbooru und Rule34 sortieren nach Gesamtbewertungen. Sankaku verwendet die offizielle Beliebtheitsreihenfolge.
Latest posts from all selected sources.|Последние публикации всех выбранных источников.|Neueste Beiträge aller ausgewählten Quellen.
New illustrations|Новые иллюстрации|Neue Illustrationen
More from the catalog|Ещё из каталога|Mehr aus dem Katalog
Show all|Показать все|Alle anzeigen
Search by tags, choose sources and rating.|Ищите по тегам, выбирайте источники и рейтинг.|Suchen Sie nach Tags und wählen Sie Quellen und Bewertung.
No images here yet. Change your search or choose another source.|Здесь пока нет изображений. Измените запрос или выберите другой источник.|Noch keine Bilder vorhanden. Ändern Sie die Suche oder wählen Sie eine andere Quelle.
This page's works are hidden by content filters.|Работы на этой странице скрыты фильтрами содержимого.|Die Werke auf dieser Seite werden durch Inhaltsfilter ausgeblendet.
This work is hidden by content filters.|Эта работа скрыта фильтрами содержимого.|Dieses Werk wird durch Inhaltsfilter ausgeblendet.
The query contains a tag hidden by content filters.|Запрос содержит тег, скрытый фильтрами содержимого.|Die Suche enthält einen durch Inhaltsfilter ausgeblendeten Tag.
Change filters|Изменить фильтры|Filter ändern
Configure hiding|Настроить скрытие|Ausblenden konfigurieren
No unseen works for these tags yet. Try another tag or source.|Непросмотренных работ по этим тегам пока нет. Попробуйте другой тег или источник.|Keine ungesehenen Werke mit diesen Tags vorhanden. Versuchen Sie andere Tags oder Quellen.
No new works for you on this page. The catalog will keep loading as you scroll.|На этой странице нет новых для вас работ. Каталог продолжит загрузку при прокрутке.|Auf dieser Seite gibt es keine neuen Werke für Sie. Beim Scrollen wird der Katalog weiter geladen.
No matching works for the selected tags. Try another rating or source.|По выбранным тегам пока нет подходящих работ. Попробуйте другой рейтинг или источник.|Keine passenden Werke für die gewählten Tags. Versuchen Sie eine andere Bewertung oder Quelle.
No results received. Try searching again.|Результаты не получены. Повторите поиск.|Keine Ergebnisse erhalten. Wiederholen Sie die Suche.
Loading more…|Загружаем ещё…|Weitere werden geladen…
All available results loaded|Все доступные результаты загружены|Alle verfügbaren Ergebnisse geladen
All available works loaded|Все доступные работы загружены|Alle verfügbaren Werke geladen
All available recommendations loaded|Все доступные рекомендации загружены|Alle verfügbaren Empfehlungen geladen
Failed to continue loading.|Не удалось продолжить загрузку.|Weitere Inhalte konnten nicht geladen werden.
Some sources are temporarily unavailable.|Часть источников временно недоступна.|Einige Quellen sind vorübergehend nicht verfügbar.
Retry sources|Повторить источники|Quellen erneut versuchen
Retry|Повторить|Erneut versuchen
Retrying automatically.|Повторяем автоматически.|Automatischer erneuter Versuch.
Source currently unavailable.|Источник сейчас недоступен.|Quelle derzeit nicht verfügbar.
Failed to load the source. Please try again.|Не удалось загрузить источник. Повторите запрос.|Quelle konnte nicht geladen werden. Bitte erneut versuchen.
The local server did not respond. Please try again.|Локальный сервер не ответил. Повторите запрос.|Der lokale Server antwortet nicht. Bitte erneut versuchen.
Sign in|Авторизуйтесь|Anmelden
Configure|Настроить|Konfigurieren
Artwork|Работа|Werk
Works|Работы|Werke
Artist's works|Работы художника|Werke des Künstlers
More from this creator|Ещё работы автора|Weitere Werke dieses Urhebers
All works by this creator|Все работы автора|Alle Werke dieses Urhebers
More works are available in the creator's profile.|Больше работ можно посмотреть в профиле автора.|Weitere Werke finden Sie im Profil des Urhebers.
No other works found in the available sources.|Других работ в доступных источниках пока не найдено.|Keine weiteren Werke in den verfügbaren Quellen gefunden.
Related works|Похожие работы|Ähnliche Werke
Based on characters and meaningful tags. Results expand as you scroll and include other creators.|По персонажам и содержательным тегам работы. Подбор расширяется при прокрутке; показаны и другие авторы.|Basierend auf Figuren und aussagekräftigen Tags. Beim Scrollen werden weitere Werke und andere Urheber einbezogen.
Related works are currently unavailable.|Похожие работы сейчас недоступны.|Ähnliche Werke sind derzeit nicht verfügbar.
Searching for related works on the next pages…|Ищем похожие работы на следующих страницах…|Ähnliche Werke werden auf weiteren Seiten gesucht…
No related works found by these tags.|Похожих работ по тегам не найдено.|Keine ähnlichen Werke mit diesen Tags gefunden.
Loading more related works…|Загружаем ещё похожие работы…|Weitere ähnliche Werke werden geladen…
No more new tag matches for this work yet.|Новые совпадения по тегам этой работы пока закончились.|Derzeit keine weiteren neuen Tag-Treffer für dieses Werk.
No new matches yet.|Новых совпадений пока нет.|Noch keine neuen Treffer.
Keep searching|Искать дальше|Weitersuchen
Image unavailable|Изображение недоступно|Bild nicht verfügbar
Video playback failed. Try again or open the post on its source site.|Видео не удалось воспроизвести. Попробуйте ещё раз или откройте запись на сайте.|Video konnte nicht abgespielt werden. Versuchen Sie es erneut oder öffnen Sie den Originalbeitrag.
Catalog|Каталог|Katalog
Catalogs|Каталоги|Kataloge
Artwork ID ·|ID работы ·|Werk-ID ·
Date not provided|Дата не указана|Datum nicht angegeben
Rating not provided|Рейтинг не указан|Bewertung nicht angegeben
Open on website ↗|Открыть на сайте ↗|Auf Website öffnen ↗
Open Sankaku ↗|Открыть Sankaku ↗|Sankaku öffnen ↗
This Sankaku work requires additional account access on the site.|Для этой работы Sankaku требуется дополнительный доступ аккаунта на сайте.|Für dieses Sankaku-Werk benötigen Sie zusätzliche Zugriffsrechte auf der Website.
Creator not specified|Автор не указан|Urheber nicht angegeben
This work's creator has not been identified yet|Автор этой работы пока не определён|Der Urheber dieses Werks ist noch nicht bekannt
The creator is not yet known. Check the source link and tags.|Автор пока не определён. Проверьте исходную ссылку и теги работы.|Der Urheber ist noch nicht bekannt. Prüfen Sie Originallink und Tags.
This work's uploader is not specified|Загрузчик этой работы не указан|Uploader dieses Werks nicht angegeben
The artist tag is not confirmed yet. The uploader is not treated as the creator.|Тег художника пока не подтверждён. Загрузчик не считается автором.|Der Künstler-Tag ist noch nicht bestätigt. Der Uploader wird nicht als Urheber behandelt.
Voice acting|Озвучка|Synchronsprecher
Animation|Анимация|Animation
Colorist|Колорист|Kolorist
Sound|Звук|Ton
Editing|Монтаж|Schnitt
Music|Музыка|Musik
Translation|Перевод|Übersetzung
Writing|Сценарий|Skript
Artist profile|Профиль художника|Künstlerprofil
Voice actor profile|Профиль актёра озвучки|Synchronsprecherprofil
Animator profile|Профиль аниматора|Animatorprofil
Contributor profile|Профиль участника|Profil der mitwirkenden Person
Profile|Профиль|Profil
Follow artist|Подписаться на художника|Künstler abonnieren
Follow creator|Подписаться на автора|Urheber abonnieren
Follow voice actor|Подписаться на актёра озвучки|Synchronsprecher abonnieren
Follow animator|Подписаться на аниматора|Animator abonnieren
Follow uploader|Подписаться на загрузчика|Uploader abonnieren
Follow sound designer|Подписаться на звукорежиссёра|Tongestalter abonnieren
Follow colorist|Подписаться на колориста|Koloristen abonnieren
Follow editor|Подписаться на монтажёра|Editor abonnieren
Follow musician|Подписаться на музыканта|Musiker abonnieren
Follow translator|Подписаться на переводчика|Übersetzer abonnieren
Follow writer|Подписаться на сценариста|Autor abonnieren
Following · Unfollow|Вы подписаны · Отписаться|Abonniert · Nicht mehr abonnieren
Follow|Подписаться|Abonnieren
Unfollow|Отписаться|Nicht mehr abonnieren
You followed this creator|Вы подписались на автора|Sie haben diesen Urheber abonniert
Unfollowed|Подписка отменена|Abonnement beendet
This artist is already followed|Этот художник уже в подписках|Dieser Künstler ist bereits abonniert
Add an artist by tag|Добавить художника по тегу|Künstler per Tag hinzufügen
For example, sample_artist|например, sample_artist|Zum Beispiel sample_artist
One artist-tag subscription shows works from Danbooru, Gelbooru, Rule34 and Sankaku when connected. Restricted Sankaku works require sign-in. Latest images refresh when the tab opens; new works are marked.|Одна подписка на тег художника показывает работы Danbooru, Gelbooru, Rule34 и Sankaku при подключённых источниках. Закрытые работы Sankaku требуют входа. Последние изображения обновляются при открытии вкладки; новые отмечены.|Ein Künstler-Tag-Abonnement zeigt Werke aus verbundenen Quellen: Danbooru, Gelbooru, Rule34 und Sankaku. Eingeschränkte Sankaku-Werke erfordern eine Anmeldung. Beim Öffnen des Tabs werden die neuesten Bilder aktualisiert und neue Werke markiert.
Add an artist tag or click Follow on one of their works.|Добавьте тег художника или нажмите «Подписаться» на его работе.|Fügen Sie einen Künstler-Tag hinzu oder klicken Sie bei einem Werk auf Abonnieren.
Gelbooru and Rule34 search by artist tag. Uploader subscriptions remain separate.|На Gelbooru и Rule34 поиск идёт по тегу художника. Подписка на загрузчика остаётся отдельной.|Gelbooru und Rule34 suchen nach Künstler-Tags. Uploader-Abonnements bleiben separat.
Artist subscriptions use confirmed tags. Rule34 artist detection requires Gelbooru and Rule34 keys: candidates are taken from Gelbooru categories and verified on Rule34. The owner field identifies the uploader and is not used for artist subscriptions.|Подписка на художника использует подтверждённый тег. Для определения художника Rule34 нужны ключи Gelbooru и Rule34: список кандидатов берётся из категорий Gelbooru и проверяется на Rule34. Поле owner считается загрузчиком; по нему подписка на художника не создаётся.|Künstler-Abonnements verwenden bestätigte Tags. Die Künstlererkennung auf Rule34 benötigt Gelbooru- und Rule34-Schlüssel: Kandidaten werden aus Gelbooru-Kategorien übernommen und auf Rule34 geprüft. Das Feld owner bezeichnet den Uploader und wird nicht für Künstler-Abonnements verwendet.
No images in this rating from the creators you follow yet.|В этом рейтинге пока нет изображений от авторов, на которых вы подписаны.|Noch keine Bilder mit dieser Bewertung von abonnierten Urhebern.
Latest works|Последние работы|Neueste Werke
Updating other creators…|Обновляем остальных авторов…|Weitere Urheber werden aktualisiert…
Hide subscription list|Скрыть список подписок|Abonnementliste ausblenden
Manage subscriptions|Управление подписками|Abonnements verwalten
Refresh|Обновить|Aktualisieren
Subscription tag|Тег подписки|Abonnement-Tag
Artist tag on Gelbooru|Тег художника на Gelbooru|Künstler-Tag auf Gelbooru
Gelbooru tag|Тег Gelbooru|Gelbooru-Tag
If the tag name differs, enter it here. An empty field restores the Danbooru tag.|Если имя тега отличается, укажите его здесь. Пустое поле вернёт тег Danbooru.|Wenn der Tag-Name abweicht, geben Sie ihn hier ein. Ein leeres Feld stellt den Danbooru-Tag wieder her.
Save|Сохранить|Speichern
Save source|Сохранить источник|Quelle speichern
Cancel|Отмена|Abbrechen
Add|Добавить|Hinzufügen
Saved works are available without searching again.|Сохранённые работы доступны без повторного поиска.|Gespeicherte Werke sind ohne erneute Suche verfügbar.
Browsing history is stored on this computer.|История просмотра хранится на этом компьютере.|Der Verlauf wird auf diesem Computer gespeichert.
History|История|Verlauf
Bookmark|Закладка|Lesezeichen
Add bookmark|Добавить в закладки|Lesezeichen hinzufügen
Bookmarked|В закладках|Als Lesezeichen gespeichert
Added to bookmarks|Добавлено в закладки|Zu Lesezeichen hinzugefügt
Removed from bookmarks|Удалено из закладок|Aus Lesezeichen entfernt
Recommendations based on tags of works you liked. Liked works do not repeat.|Подборка по тегам изображений, которые вы отметили сердечком. Понравившиеся работы не повторяются.|Empfehlungen anhand der Tags Ihrer mit Herz markierten Werke. Bereits markierte Werke werden nicht erneut angezeigt.
Like images with the heart button to get recommendations here.|Поставьте лайк сердечком, и здесь появятся рекомендации.|Markieren Sie Bilder mit dem Herz, um hier Empfehlungen zu erhalten.
No suitable recommendation tags in your liked works yet.|У понравившихся работ пока нет подходящих тегов для подбора.|Ihre mit Herz markierten Werke haben noch keine passenden Tags für Empfehlungen.
All liked works are hidden by filters. Change content settings to get recommendations.|Все понравившиеся работы скрыты фильтрами. Измените настройки содержимого, чтобы получить рекомендации.|Alle mit Herz markierten Werke werden durch Filter ausgeblendet. Ändern Sie die Inhaltseinstellungen, um Empfehlungen zu erhalten.
Your frequent tags|Ваши частые теги|Ihre häufigen Tags
Content tags|Теги содержания|Inhalts-Tags
Frequent specific tags influence recommendations. Broad muted tags count only with yellow priority. Configure with right-click.|Частые необычные теги влияют на подбор. Приглушённые общие теги учитываются только с жёлтым приоритетом. Настройка — правой кнопкой мыши.|Häufige spezifische Tags beeinflussen Empfehlungen. Gedämpfte allgemeine Tags zählen nur mit gelber Priorität. Einstellungen per Rechtsklick.
Find a content tag|Найти тег содержания|Inhalts-Tag suchen
Find a tag, for example group_sex|Найти тег, например group_sex|Tag suchen, zum Beispiel group_sex
Right-click to customize recommendations|Правая кнопка — настроить рекомендации|Rechtsklick zum Anpassen der Empfehlungen
Show more often|Показывать чаще|Häufiger anzeigen
Normal priority|Обычный приоритет|Normale Priorität
Disabled for recommendations|Выключен для рекомендаций|Für Empfehlungen deaktiviert
Disable tag|Выключить тег|Tag deaktivieren
Broad tag: enable yellow priority to influence recommendations|Общий тег: включите жёлтый приоритет, чтобы он влиял на подбор|Allgemeiner Tag: Aktivieren Sie gelbe Priorität für Empfehlungen
Finding more…|Подбираем ещё…|Weitere werden gesucht…
Finished searching available sources. Paused sources can be retried.|Подбор в доступных источниках завершён. Приостановленные источники можно повторить.|Die Suche in verfügbaren Quellen ist abgeschlossen. Pausierte Quellen können erneut versucht werden.
Failed to continue recommendations.|Не удалось продолжить подбор.|Weitere Empfehlungen konnten nicht geladen werden.
Search tag selection|Выбор тегов для поиска|Tag-Auswahl für die Suche
Selected:|Выбрано:|Ausgewählt:
Reset|Сбросить|Zurücksetzen
Collapse tags|Свернуть теги|Tags einklappen
Recent searches|Недавние запросы|Letzte Suchanfragen
No matching tags|Таких тегов нет|Keine passenden Tags
Settings saved|Настройки сохранены|Einstellungen gespeichert
Tab settings saved|Настройки вкладок сохранены|Tab-Einstellungen gespeichert
Signed in to Sankaku|Вход в Sankaku выполнен|Bei Sankaku angemeldet
Signed out of Sankaku|Вы вышли из Sankaku|Bei Sankaku abgemeldet
Gelbooru tag saved|Тег Gelbooru сохранён|Gelbooru-Tag gespeichert
Failed to read settings|Настройки не удалось прочитать|Einstellungen konnten nicht gelesen werden
Failed to read content filters|Фильтры содержимого не удалось прочитать|Inhaltsfilter konnten nicht gelesen werden
Failed to save settings|Не удалось сохранить настройки|Einstellungen konnten nicht gespeichert werden
Failed to save filters|Не удалось сохранить фильтры|Filter konnten nicht gespeichert werden
Failed to read bookmarks|Закладки не удалось прочитать|Lesezeichen konnten nicht gelesen werden
Failed to change bookmarks|Не удалось изменить закладки|Lesezeichen konnten nicht geändert werden
Failed to read subscriptions|Подписки не удалось прочитать|Abonnements konnten nicht gelesen werden
Failed to change subscription|Не удалось изменить подписку|Abonnement konnte nicht geändert werden
Failed to load the subscription list.|Не удалось загрузить список подписок.|Abonnementliste konnte nicht geladen werden.
Failed to save the Gelbooru tag|Не удалось сохранить тег Gelbooru|Gelbooru-Tag konnte nicht gespeichert werden
Failed to load the profile.|Не удалось загрузить профиль.|Profil konnte nicht geladen werden.
Failed to read favorite tags|Избранные теги не удалось прочитать|Lieblings-Tags konnten nicht gelesen werden
Failed to save the favorite tag|Не удалось сохранить избранный тег|Lieblings-Tag konnte nicht gespeichert werden
Failed to save the tag preference. Try again.|Не удалось сохранить настройку тега. Попробуйте ещё раз.|Tag-Einstellung konnte nicht gespeichert werden. Bitte erneut versuchen.
Failed to read viewed history|Историю просмотренных работ не удалось прочитать|Verlauf angesehener Werke konnte nicht gelesen werden
Failed to save viewed history|Историю просмотренных работ не удалось сохранить|Verlauf angesehener Werke konnte nicht gespeichert werden
Failed to save the viewed marker. The New label may reappear next time.|Не удалось сохранить отметку просмотра. При следующем открытии метка «Новое» может повториться.|Angesehen-Markierung konnte nicht gespeichert werden. Die Kennzeichnung Neu kann beim nächsten Öffnen erneut erscheinen.
Enter one or more tags|Введите один или несколько тегов|Geben Sie einen oder mehrere Tags ein
A tag cannot exceed 100 characters|Один тег не может быть длиннее 100 символов|Ein Tag darf höchstens 100 Zeichen lang sein
You can exclude up to 100 tags|Можно исключить не больше 100 тегов|Sie können höchstens 100 Tags ausschließen
Enter one artist tag without special search commands|Укажите один тег художника без специальных команд поиска|Geben Sie einen Künstler-Tag ohne spezielle Suchbefehle ein
The tag combination is too long. Select fewer tags.|Слишком длинная комбинация тегов. Выберите меньше тегов.|Die Tag-Kombination ist zu lang. Wählen Sie weniger Tags.
Set an API key in settings to load Gelbooru works.|Для работ Gelbooru укажите API key в настройках.|Geben Sie in den Einstellungen einen API-Schlüssel für Gelbooru-Werke an.
Questionable — borderline content|Questionable — пограничный контент|Questionable — grenzwertige Inhalte
Votes:|Голоса:|Stimmen:
More|Ещё|Weitere
tags|тегов|Tags
of|из|von
records ·|записей ·|Datensätze ·
new|новых|neue
signed in|вход выполнен|angemeldet
guest access|гостевой доступ|Gastzugang
connected|подключён|verbunden
requires key|требует ключ|Schlüssel erforderlich
local build|локальная сборка|lokaler Build
unavailable|недоступен|nicht verfügbar
· uploader|· загрузчик|· Uploader
· key needed|· нужен ключ|· Schlüssel benötigt
· paused|· пауза|· pausiert
· check API|· проверьте API|· API prüfen
· sign-in required|· требуется вход|· Anmeldung erforderlich
loading|загрузку|Laden
search|поиск|Suche
favorites|избранное|Favoriten
Works shown:|Показано работ:|Angezeigte Werke:
Records loaded:|Загружено записей:|Geladene Datensätze:
Grouped copies:|Объединено копий:|Zusammengefasste Kopien:
Viewed and saved:|Просмотренные и сохранённые:|Angesehen und gespeichert:
Hidden by filters:|Скрыты фильтрами:|Durch Filter ausgeblendet:
: records without an accessible file in the API —|: записей без доступного файла в API —|: Datensätze ohne zugängliche Datei in der API —
: records missing the required tags —|: записей без нужных тегов —|: Datensätze ohne erforderliche Tags —
: records with a different rating —|: записей другого рейтинга —|: Datensätze mit anderer Bewertung —
Ctrl + click — select · Enter — search|Ctrl + клик — выбор · Enter — поиск|Strg + Klick — auswählen · Eingabe — suchen
Find a tab…|Найти вкладку…|Tab suchen…
Open|Открыть|Öffnen
Recommended|Рекомендуется|Empfohlen
Tags|Теги|Tags
Video|Видео|Video
NSFW — explicit content|NSFW — откровенный контент|NSFW — explizite Inhalte
Find a tab|Найти вкладку|Tab suchen
Close tab list|Закрыть список вкладок|Tab-Liste schließen
Close all tabs, including pinned tabs|Закрыть все вкладки, включая закреплённые|Alle Tabs schließen, einschließlich angehefteter Tabs
Click or Enter to search selected tags. Ctrl + click to deselect.|Клик или Enter — искать выбранные теги. Ctrl + клик — снять выбор.|Klicken oder Eingabe für die Suche nach ausgewählten Tags. Strg + Klick zum Abwählen.
Ctrl + click to select a tag. Click normally to search this tag.|Ctrl + клик — выбрать тег. Обычный клик — искать этот тег.|Strg + Klick zum Auswählen eines Tags. Normaler Klick für die Suche nach diesem Tag.
Installed:|Установлено:|Installiert:
Version available|Доступна версия|Version verfügbar
Install DART|Установить DART|DART installieren
Remove tag|Удалить тег|Tag entfernen
Favorite tag|Избранный тег|Lieblings-Tag
Add tag to favorites|Добавить тег в избранное|Tag zu Favoriten hinzufügen
Remove tag from favorites|Убрать тег из избранного|Tag aus Favoriten entfernen
Remove tag|Убрать тег|Tag entfernen
Key already saved|Ключ уже сохранён|Schlüssel bereits gespeichert
Enter API key|Введите API key|API-Schlüssel eingeben
Double-click to pin|Двойной клик — закрепить|Zum Anheften doppelklicken
Go to:|Перейти:|Wechseln zu:
Records available:|Доступно записей:|Verfügbare Datensätze:
Grouped:|Объединено:|Zusammengefasst:
Hidden by filters:|Скрыто фильтрами:|Durch Filter ausgeblendet:
Add to favorite tags|Добавить в избранные теги|Zu Lieblings-Tags hinzufügen
Remove from favorite tags|Убрать из избранных тегов|Aus Lieblings-Tags entfernen
Grouped|Объединено|Zusammengefasst:
The search query is too long.|Поисковый запрос слишком длинный.|Die Suchanfrage ist zu lang.
This profile is currently unavailable.|Профиль сейчас недоступен.|Dieses Profil ist derzeit nicht verfügbar.
Invalid identifier.|Неверный идентификатор.|Ungültige Kennung.
Sankaku sign-in is currently unavailable. Try again later.|Сервис входа Sankaku сейчас недоступен. Повторите позже.|Die Sankaku-Anmeldung ist derzeit nicht verfügbar. Versuchen Sie es später erneut.
Enter a GitHub repository URL: https://github.com/owner/name.|Нужна ссылка на репозиторий https://github.com/owner/name.|Geben Sie eine GitHub-Repository-URL ein: https://github.com/owner/name.
Update settings are available in an installed copy of DART.|Настройка обновлений доступна в установленной DART.|Update-Einstellungen sind in einer installierten DART-Version verfügbar.
Wait for installation to finish.|Дождитесь завершения установки.|Warten Sie, bis die Installation abgeschlossen ist.
Invalid GitHub token.|Неверный токен GitHub.|Ungültiges GitHub-Token.
The release is missing the complete update file or its signature.|В выпуске нет полного файла обновления или подписи.|Dem Release fehlt die vollständige Update-Datei oder ihre Signatur.
The update file is outside the selected repository.|Файл обновления расположен за пределами выбранного репозитория.|Die Update-Datei liegt außerhalb des ausgewählten Repositorys.
Could not check GitHub. Check access and try again later.|Не удалось проверить GitHub. Проверьте доступ и повторите позже.|GitHub konnte nicht geprüft werden. Prüfen Sie den Zugriff und versuchen Sie es später erneut.
Update checks are temporarily unavailable. Try again later.|Проверка обновлений временно недоступна. Повторите позже.|Die Update-Prüfung ist vorübergehend nicht verfügbar. Versuchen Sie es später erneut.
No verified update is available yet.|Проверенного обновления пока нет.|Es ist noch kein verifiziertes Update verfügbar.
The update size does not match the signed release.|Размер обновления не совпадает с подписанным выпуском.|Die Update-Größe stimmt nicht mit dem signierten Release überein.
Could not start the update installation.|Не удалось запустить установку обновления.|Die Update-Installation konnte nicht gestartet werden.
Rule34 rate limit reached (HTTP 429). Loading will resume automatically.|Rule34 ограничил частоту запросов (HTTP 429). Загрузка возобновится автоматически.|Das Rule34-Anfragelimit wurde erreicht (HTTP 429). Der Ladevorgang wird automatisch fortgesetzt.
Rule34 rejected the API key. Check your details in settings.|Rule34 отклонил ключ API. Проверьте данные в настройках.|Rule34 hat den API-Schlüssel abgelehnt. Prüfen Sie Ihre Angaben in den Einstellungen.
Rule34 temporarily restricted access (HTTP 403). We will retry later.|Rule34 временно ограничил доступ (HTTP 403). Повторим позже.|Rule34 hat den Zugriff vorübergehend eingeschränkt (HTTP 403). Ein neuer Versuch erfolgt später.
Rule34 did not respond in time. Loading will retry automatically.|Rule34 не ответил вовремя. Повторим загрузку автоматически.|Rule34 hat nicht rechtzeitig geantwortet. Der Ladevorgang wird automatisch erneut versucht.
Rule34 returned an incomplete response or a protection page. We will retry later.|Rule34 вернул неполный ответ или страницу защиты вместо данных. Повторим позже.|Rule34 hat eine unvollständige Antwort oder eine Schutzseite zurückgegeben. Ein neuer Versuch erfolgt später.
Rule34 search is temporarily unavailable on the site. Loading will resume automatically.|Поиск Rule34 временно недоступен на стороне сайта. Загрузка возобновится автоматически.|Die Rule34-Suche ist auf der Website vorübergehend nicht verfügbar. Der Ladevorgang wird automatisch fortgesetzt.
Rule34 returned an incomplete response instead of works. We will retry later.|Rule34 вернул неполный ответ вместо списка работ. Повторим позже.|Rule34 hat statt der Werkliste eine unvollständige Antwort zurückgegeben. Ein neuer Versuch erfolgt später.
Rule34 is temporarily unavailable (HTTP|Rule34 временно не отвечает (HTTP|Rule34 ist vorübergehend nicht verfügbar (HTTP
). We will retry later.|). Повторим позже.|). Ein neuer Versuch erfolgt später.
Sankaku did not return a list of works. Check your tags.|Sankaku не вернул список работ. Проверьте теги.|Sankaku hat keine Werkliste zurückgegeben. Prüfen Sie Ihre Tags.
Sign in to Sankaku to view this work.|Для просмотра этой работы авторизуйтесь в Sankaku.|Melden Sie sich bei Sankaku an, um dieses Werk anzusehen.
Sign in to Sankaku in settings to access these works.|Авторизуйтесь в Sankaku в настройках, чтобы получить доступ к этим работам.|Melden Sie sich in den Einstellungen bei Sankaku an, um auf diese Werke zuzugreifen.
Sankaku restricted access for this account. Check access requirements or your Plus subscription on the site.|Sankaku ограничил доступ для этого аккаунта. Проверьте условия доступа или подписку Plus на сайте.|Sankaku hat den Zugriff für dieses Konto eingeschränkt. Prüfen Sie die Zugangsbedingungen oder Ihr Plus-Abonnement auf der Website.
Enter your Sankaku username and password.|Введите логин и пароль Sankaku.|Geben Sie Ihren Sankaku-Benutzernamen und Ihr Passwort ein.
Too many sign-in attempts. Wait and try again.|Слишком много запросов входа. Подождите и повторите.|Zu viele Anmeldeversuche. Warten Sie und versuchen Sie es erneut.
Sankaku requires two-factor authentication. This sign-in method does not support it yet.|Sankaku требует двухэтапную проверку. Этот способ входа пока не поддерживает её.|Sankaku erfordert Zwei-Faktor-Authentifizierung. Diese Anmeldemethode unterstützt sie noch nicht.
Incorrect Sankaku username or password.|Неверный логин или пароль Sankaku.|Falscher Sankaku-Benutzername oder falsches Passwort.
Sankaku sign-in is temporarily unavailable. Try again later.|Вход Sankaku временно недоступен. Повторите позже.|Die Sankaku-Anmeldung ist vorübergehend nicht verfügbar. Versuchen Sie es später erneut.
Invalid Sankaku identifier.|Неверный идентификатор Sankaku.|Ungültige Sankaku-Kennung.
Sankaku rejected the request. Try fewer tags.|Sankaku не принял запрос. Попробуйте меньше тегов.|Sankaku hat die Anfrage abgelehnt. Versuchen Sie es mit weniger Tags.
Could not refresh Sankaku sign-in. Wait and try again.|Не удалось обновить вход Sankaku. Подождите и повторите.|Die Sankaku-Anmeldung konnte nicht erneuert werden. Warten Sie und versuchen Sie es erneut.
This source is not supported.|Источник не поддерживается.|Diese Quelle wird nicht unterstützt.
The site rate limit was reached (HTTP|Сайт ограничил частоту запросов (HTTP|Das Anfragelimit der Website wurde erreicht (HTTP
). Wait and try again.|). Подождите и повторите.|). Warten Sie und versuchen Sie es erneut.
The source server is temporarily unavailable (HTTP|Сервер источника временно не отвечает (HTTP|Der Quellserver ist vorübergehend nicht verfügbar (HTTP
). Try again later.|). Повторите позже.|). Versuchen Sie es später erneut.
The source denied access (HTTP|Источник отклонил доступ (HTTP|Die Quelle hat den Zugriff verweigert (HTTP
). Check the API key in settings.|). Проверьте ключ API в настройках.|). Prüfen Sie den API-Schlüssel in den Einstellungen.
The source returned HTTP error|Источник вернул ошибку HTTP|Die Quelle hat einen HTTP-Fehler zurückgegeben:
. Try again later.|. Повторите запрос позже.|. Versuchen Sie es später erneut.
The source did not respond in time. Try again.|Источник не ответил вовремя. Повторите запрос.|Die Quelle hat nicht rechtzeitig geantwortet. Versuchen Sie es erneut.
The source is currently unavailable. Try again later.|Источник сейчас недоступен. Повторите запрос позже.|Die Quelle ist derzeit nicht verfügbar. Versuchen Sie es später erneut.
The source returned an invalid post ID.|Источник вернул неверный ID публикации.|Die Quelle hat eine ungültige Beitrags-ID zurückgegeben.
Could not determine the latest post from this source.|Не удалось определить последнюю публикацию источника.|Der neueste Beitrag dieser Quelle konnte nicht ermittelt werden.
Could not determine the post ID from this source.|Не удалось определить ID публикации источника.|Die Beitrags-ID dieser Quelle konnte nicht ermittelt werden.
Could not read the Gelbooru date.|Не удалось прочитать дату Gelbooru.|Das Gelbooru-Datum konnte nicht gelesen werden.
Could not read the Rule34 date.|Не удалось прочитать дату Rule34.|Das Rule34-Datum konnte nicht gelesen werden.
The source did not return a post to determine the start of the month.|Источник не вернул публикацию для определения начала месяца.|Die Quelle hat keinen Beitrag zur Ermittlung des Monatsbeginns zurückgegeben.
Enter your Gelbooru user ID and API key in settings.|Укажите user ID и API key Gelbooru в настройках.|Geben Sie Ihre Gelbooru-User-ID und Ihren API-Schlüssel in den Einstellungen ein.
Enter your Rule34 user ID and API key in settings.|Укажите user ID и API key Rule34 в настройках.|Geben Sie Ihre Rule34-User-ID und Ihren API-Schlüssel in den Einstellungen ein.
Rule34 search is temporarily unavailable on the site. Try again later.|Поиск Rule34 временно недоступен на стороне сайта. Повторите позже.|Die Rule34-Suche ist auf der Website vorübergehend nicht verfügbar. Versuchen Sie es später erneut.
`; 
  root.DartMessages = rows.trim().split('\n').map(row => row.split('|'));
  if (typeof module !== 'undefined') module.exports = root.DartMessages;
})(typeof window !== 'undefined' ? window : globalThis);
