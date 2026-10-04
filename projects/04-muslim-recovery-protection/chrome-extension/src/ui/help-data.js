// Curated general support, not diagnosis or treatment. No browsing or persistent state.
export const NEEDS = ["hunger", "fatigue", "loneliness", "anger", "boredom", "stress"];
export const SUGGESTIONS = [
  {
    "id": "ground",
    "needs": [
      "stress",
      "anger"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Feel your feet",
        "Notice the floor or chair supporting you. Name three things you can see."
      ],
      "ar": [
        "ثبّت انتباهك",
        "اشعر بالأرض أو المقعد الذي يسندك، وسمّ ثلاثة أشياء تراها."
      ],
      "de": [
        "Spüre den Boden",
        "Spüre den Boden oder Stuhl, der dich trägt. Benenne drei Dinge, die du siehst."
      ]
    }
  },
  {
    "id": "breathe",
    "needs": [
      "stress",
      "anger"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Breathe comfortably",
        "Let your breathing be gentle, without holding or forcing a deep breath."
      ],
      "ar": [
        "تنفّس براحة",
        "تنفّس برفق دون حبس النفس أو إجبار نفسك على نفس عميق."
      ],
      "de": [
        "Atme angenehm",
        "Atme sanft, ohne den Atem anzuhalten oder tiefes Atmen zu erzwingen."
      ]
    }
  },
  {
    "id": "unhook",
    "needs": [
      "stress"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Notice a thought",
        "Try: I notice I am having a self-critical thought. Return to one useful action."
      ],
      "ar": [
        "لاحظ الفكرة",
        "جرّب: ألاحظ أنني أفكر بلوم نفسي. ثم عد إلى فعل واحد ينفعك."
      ],
      "de": [
        "Bemerke einen Gedanken",
        "Versuche: Ich bemerke einen selbstkritischen Gedanken. Kehre zu einer hilfreichen Handlung zurück."
      ]
    }
  },
  {
    "id": "kindness",
    "needs": [
      "stress",
      "loneliness"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Speak kindly to yourself",
        "Use the same respectful words you would offer a friend in difficulty."
      ],
      "ar": [
        "ارفق بنفسك",
        "استخدم كلمات محترمة مثلما تخاطب صديقًا يمر بصعوبة."
      ],
      "de": [
        "Sei freundlich zu dir",
        "Sprich so respektvoll mit dir, wie mit einem Freund in einer schwierigen Situation."
      ]
    }
  },
  {
    "id": "water",
    "needs": [
      "hunger",
      "fatigue"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Water if needed",
        "Drink a comfortable amount if you need it, suited to your circumstances."
      ],
      "ar": [
        "ماء عند الحاجة",
        "اشرب قدرًا مريحًا إذا احتجت، بما يناسب ظروفك."
      ],
      "de": [
        "Wasser bei Bedarf",
        "Trinke bei Bedarf eine angenehme Menge, passend zu deiner Situation."
      ]
    }
  },
  {
    "id": "food",
    "needs": [
      "hunger"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Something to eat",
        "Choose food that suits your needs, allergies and circumstances if you are hungry."
      ],
      "ar": [
        "طعام عند الجوع",
        "اختر طعامًا يناسب احتياجك وحساسياتك وظروفك إذا كنت جائعًا."
      ],
      "de": [
        "Etwas essen",
        "Wähle bei Hunger etwas, das zu deinen Bedürfnissen, Allergien und Umständen passt."
      ]
    }
  },
  {
    "id": "rest",
    "needs": [
      "fatigue"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Short rest",
        "Find a comfortable place and rest for a few minutes if possible."
      ],
      "ar": [
        "استراحة قصيرة",
        "اختر مكانًا مريحًا واسترح بضع دقائق إن أمكن."
      ],
      "de": [
        "Kurze Pause",
        "Suche einen angenehmen Ort und ruhe dich wenn möglich einige Minuten aus."
      ]
    }
  },
  {
    "id": "sleep",
    "needs": [
      "fatigue"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Prepare for sleep",
        "If it is time to sleep, put the device away and start your usual sleep routine."
      ],
      "ar": [
        "استعد للنوم",
        "إذا حان وقت النوم، أبعد الجهاز وابدأ روتين نومك المعتاد."
      ],
      "de": [
        "Schlaf vorbereiten",
        "Wenn Schlafenszeit ist, lege das Gerät weg und beginne deine übliche Abendroutine."
      ]
    }
  },
  {
    "id": "move",
    "needs": [
      "stress",
      "boredom"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Change your place",
        "Move to a suitable safe place, or change your sitting position."
      ],
      "ar": [
        "غيّر مكانك",
        "انتقل إلى مكان مناسب وآمن أو غيّر موضع جلوسك."
      ],
      "de": [
        "Wechsle den Ort",
        "Gehe an einen passenden sicheren Ort oder ändere deine Sitzposition."
      ]
    }
  },
  {
    "id": "device",
    "needs": [
      "boredom",
      "stress"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Put the device aside",
        "Place it out of easy reach for the next few minutes."
      ],
      "ar": [
        "أبعد الجهاز قليلًا",
        "ضعه بعيدًا عن متناول يدك لبضع دقائق."
      ],
      "de": [
        "Gerät weglegen",
        "Lege es für die nächsten Minuten außer unmittelbare Reichweite."
      ]
    }
  },
  {
    "id": "walk",
    "needs": [
      "anger",
      "boredom",
      "stress"
    ],
    "seconds": 120,
    "copy": {
      "en": [
        "Walk a little",
        "Take a short safe walk, or move gently in a way that suits you."
      ],
      "ar": [
        "امشِ قليلًا",
        "امشِ مشيًا قصيرًا وآمنًا أو تحرّك برفق بما يناسبك."
      ],
      "de": [
        "Etwas gehen",
        "Gehe kurz und sicher spazieren oder bewege dich sanft, wie es dir möglich ist."
      ]
    }
  },
  {
    "id": "stretch",
    "needs": [
      "fatigue",
      "stress"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Comfortable movement",
        "Try a gentle comfortable movement. Stop if it hurts."
      ],
      "ar": [
        "حركة مريحة",
        "جرّب حركة لطيفة ومريحة وتوقف إذا آلمتك."
      ],
      "de": [
        "Angenehme Bewegung",
        "Probiere eine sanfte angenehme Bewegung. Höre bei Schmerzen auf."
      ]
    }
  },
  {
    "id": "message",
    "needs": [
      "loneliness"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Prepare a message",
        "Write: Could we talk for a little while if you have time? Send it yourself if you choose."
      ],
      "ar": [
        "جهّز رسالة",
        "اكتب: هل يمكن أن نتحدث قليلًا إذا كان وقتك يسمح؟ أرسلها بنفسك إن رغبت."
      ],
      "de": [
        "Nachricht vorbereiten",
        "Schreibe: Können wir kurz reden, wenn du Zeit hast? Sende sie selbst, wenn du möchtest."
      ]
    }
  },
  {
    "id": "company",
    "needs": [
      "loneliness"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Spend time near others",
        "Choose a safe shared place or a person whose company feels supportive."
      ],
      "ar": [
        "اقترب من صحبة آمنة",
        "اختر مكانًا مشتركًا وآمنًا أو شخصًا تجد في صحبته دعمًا."
      ],
      "de": [
        "Nähe suchen",
        "Wähle einen sicheren gemeinsamen Ort oder einen Menschen, dessen Nähe dir hilft."
      ]
    }
  },
  {
    "id": "call",
    "needs": [
      "loneliness"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Ask for a short conversation",
        "Contact someone you trust if available; you decide what to share."
      ],
      "ar": [
        "اطلب حديثًا قصيرًا",
        "تواصل مع شخص تثق به إن كان متاحًا، واختر ما تريد مشاركته."
      ],
      "de": [
        "Kurzes Gespräch erbitten",
        "Wende dich wenn möglich an einen vertrauten Menschen. Du entscheidest, was du teilst."
      ]
    }
  },
  {
    "id": "desk",
    "needs": [
      "boredom"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Clear a small surface",
        "Put away three things. That is enough for a start."
      ],
      "ar": [
        "رتّب مساحة صغيرة",
        "أعد ثلاثة أشياء إلى مكانها، وهذا يكفي للبداية."
      ],
      "de": [
        "Kleine Fläche aufräumen",
        "Räume drei Dinge weg. Das reicht für den Anfang."
      ]
    }
  },
  {
    "id": "notes",
    "needs": [
      "boredom"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Review one note",
        "Open your own notes and pick a single point to work on."
      ],
      "ar": [
        "راجع ملاحظة واحدة",
        "افتح ملاحظاتك واختر نقطة واحدة للعمل عليها."
      ],
      "de": [
        "Eine Notiz ansehen",
        "Öffne deine Notizen und wähle einen einzigen Punkt zum Bearbeiten."
      ]
    }
  },
  {
    "id": "read",
    "needs": [
      "boredom"
    ],
    "seconds": 120,
    "copy": {
      "en": [
        "Read two pages",
        "Choose a specific book or document instead of open-ended browsing."
      ],
      "ar": [
        "اقرأ صفحتين",
        "اختر كتابًا أو ملفًا محددًا بدل التصفح المفتوح."
      ],
      "de": [
        "Zwei Seiten lesen",
        "Wähle ein bestimmtes Buch oder Dokument statt unbegrenztem Surfen."
      ]
    }
  },
  {
    "id": "task",
    "needs": [
      "boredom"
    ],
    "seconds": 120,
    "copy": {
      "en": [
        "Start the smallest task",
        "Pick the first small part of something you want to return to."
      ],
      "ar": [
        "ابدأ أصغر مهمة",
        "اختر أول جزء صغير من أمر تريد العودة إليه."
      ],
      "de": [
        "Kleinste Aufgabe starten",
        "Wähle den ersten kleinen Teil einer Aufgabe, zu der du zurückkehren möchtest."
      ]
    }
  },
  {
    "id": "draw",
    "needs": [
      "boredom",
      "stress"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Draw for a minute",
        "Use paper to draw simple shapes without needing a good result."
      ],
      "ar": [
        "ارسم لدقيقة",
        "ارسم أشكالًا بسيطة على ورق دون اشتراط نتيجة جيدة."
      ],
      "de": [
        "Eine Minute zeichnen",
        "Zeichne einfache Formen auf Papier, ohne ein gutes Ergebnis zu verlangen."
      ]
    }
  },
  {
    "id": "listen",
    "needs": [
      "stress",
      "loneliness"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Listen deliberately",
        "Choose a familiar calming recording and listen without endless searching."
      ],
      "ar": [
        "استمع باختيار واضح",
        "اختر تسجيلًا مألوفًا ومريحًا واستمع دون بحث متواصل."
      ],
      "de": [
        "Bewusst zuhören",
        "Wähle eine vertraute angenehme Aufnahme und höre ohne endloses Suchen zu."
      ]
    }
  },
  {
    "id": "wash",
    "needs": [
      "fatigue",
      "stress"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Freshen up",
        "Wash your face or shower at a comfortable temperature if suitable."
      ],
      "ar": [
        "انتعش وتنظّف",
        "اغسل وجهك أو استحم بماء مريح إذا كان ذلك مناسبًا."
      ],
      "de": [
        "Frisch machen",
        "Wasche dein Gesicht oder dusche angenehm temperiert, wenn es passt."
      ]
    }
  },
  {
    "id": "pause",
    "needs": [
      "anger"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Pause before responding",
        "Wait a minute before sending a heated message. You can return to it later."
      ],
      "ar": [
        "تمهّل قبل الرد",
        "انتظر دقيقة قبل إرسال رسالة غاضبة؛ يمكنك الرجوع إليها لاحقًا."
      ],
      "de": [
        "Vor Antwort pausieren",
        "Warte vor einer wütenden Nachricht eine Minute. Du kannst später darauf zurückkommen."
      ]
    }
  },
  {
    "id": "name",
    "needs": [
      "anger",
      "stress"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Name what you feel",
        "Use a few words on paper. You do not need to judge or explain the feeling."
      ],
      "ar": [
        "سمِّ ما تشعر به",
        "اكتب كلمات قليلة على ورق دون الحكم على الشعور أو تفسيره."
      ],
      "de": [
        "Gefühl benennen",
        "Schreibe wenige Wörter auf Papier. Du musst das Gefühl weder bewerten noch erklären."
      ]
    }
  },
  {
    "id": "value",
    "needs": [
      "stress",
      "boredom"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Return to a value",
        "Name something that matters to you and one tiny action that supports it."
      ],
      "ar": [
        "ارجع إلى قيمة",
        "سمِّ أمرًا يهمك وفعلًا صغيرًا يخدمه."
      ],
      "de": [
        "Zu einem Wert zurückkehren",
        "Benenne etwas, das dir wichtig ist, und eine kleine passende Handlung."
      ]
    }
  },
  {
    "id": "outside",
    "needs": [
      "boredom",
      "loneliness"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Notice your surroundings",
        "Look around a safe place and notice sounds, light and ordinary details."
      ],
      "ar": [
        "لاحظ ما حولك",
        "لاحظ الأصوات والضوء والتفاصيل العادية في مكان آمن."
      ],
      "de": [
        "Umgebung bemerken",
        "Bemerke an einem sicheren Ort Geräusche, Licht und alltägliche Einzelheiten."
      ]
    }
  },
  {
    "id": "hands",
    "needs": [
      "stress"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Do something with your hands",
        "Fold a cloth, tidy a drawer or choose another small familiar activity."
      ],
      "ar": [
        "اشغل يديك بفعل بسيط",
        "اطوِ قطعة قماش أو رتّب درجًا أو اختر نشاطًا صغيرًا مألوفًا."
      ],
      "de": [
        "Hände beschäftigen",
        "Falte ein Tuch, ordne eine Schublade oder wähle eine andere vertraute kleine Tätigkeit."
      ]
    }
  },
  {
    "id": "plan",
    "needs": [
      "boredom",
      "fatigue"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Choose the next ten minutes",
        "Pick one manageable action and leave the rest of the day for later."
      ],
      "ar": [
        "اختر الدقائق العشر القادمة",
        "اختر فعلًا ممكنًا واترك بقية اليوم لوقتها."
      ],
      "de": [
        "Nächste zehn Minuten wählen",
        "Wähle eine machbare Handlung. Den Rest des Tages kannst du später planen."
      ]
    }
  },
  {
    "id": "kindact",
    "needs": [
      "loneliness",
      "boredom"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "A small kind action",
        "Offer a kind word or practical help within your capacity."
      ],
      "ar": [
        "فعل طيب صغير",
        "قدّم كلمة طيبة أو مساعدة عملية بقدر استطاعتك."
      ],
      "de": [
        "Kleine freundliche Handlung",
        "Biete ein freundliches Wort oder praktische Hilfe an, soweit es dir möglich ist."
      ]
    }
  },
  {
    "id": "urge",
    "needs": [
      "stress",
      "boredom"
    ],
    "seconds": 60,
    "copy": {
      "en": [
        "Let the moment pass",
        "Notice the urge as a present experience. Keep your attention on one safe action."
      ],
      "ar": [
        "دع اللحظة تمر",
        "لاحظ الرغبة بوصفها تجربة حاضرة وأعد انتباهك إلى فعل آمن واحد."
      ],
      "de": [
        "Moment vorbeiziehen lassen",
        "Bemerke den Drang als gegenwärtiges Erleben und richte dich auf eine sichere Handlung."
      ]
    }
  }
];

export function rankSuggestions(suggestions, needs = [], favorites = [], unsuitable = []) {
    const selected = new Set(needs), liked = new Set(favorites), rejected = new Set(unsuitable);
    return suggestions.filter(step => !rejected.has(step.id)).map((step, order) => ({step, order,
        score: step.needs.filter(need => selected.has(need)).length * 2 + Number(liked.has(step.id))
    })).sort((a, b) => b.score - a.score || a.order - b.order).map(item => item.step);
}
export function ifThen(ifText, thenText, language = 'ar') {
    const first = ifText.trim(), next = thenText.trim();
    if (!first && !next) return '';
    if (!first || !next) return null;
    return language === 'ar' ? `لو ${first}، فسوف ${next}.` : language === 'de' ? `Wenn ${first}, dann werde ich ${next}.` : `If ${first}, then I will ${next}.`;
}
export function remainingSeconds(deadline, now = Date.now()) { return Math.max(0, Math.ceil((deadline - now) / 1000)); }
export function makeCustomStep(text, needs, id) {
    if (typeof text !== 'string' || !text.trim() || text.trim().length > 4000) return null;
    return {id, text:text.trim(), needs:needs.filter(need => NEEDS.includes(need))};
}


// History follows real selections; an excluded suggestion never resurfaces on Back.
export function createSuggestionHistory() {
    let ids = [], cursor = -1;
    return {
        current: () => ids[cursor] ?? null,
        reset() { ids = []; cursor = -1; },
        select(id) { ids = [id]; cursor = 0; },
        next(candidates) {
            const available = new Set(candidates.map(step => step.id));
            for (let index = cursor + 1; index < ids.length; index++) {
                if (available.has(ids[index])) { cursor = index; return ids[cursor]; }
            }
            const next = candidates.find(step => !ids.includes(step.id));
            if (!next) { cursor = ids.length; return null; }
            ids.push(next.id); cursor = ids.length - 1; return next.id;
        },
        previous(excluded = []) {
            const rejected = new Set(excluded);
            for (let index = cursor - 1; index >= 0; index--) {
                if (!rejected.has(ids[index])) { cursor = index; return ids[cursor]; }
            }
            return null;
        },
        canGoBack(excluded = []) {
            const rejected = new Set(excluded);
            return ids.slice(0, cursor).some(id => !rejected.has(id));
        }
    };
}
export function makeReview(draft, context, createdAt = Date.now()) {
    const fields = ['trigger', 'ifText', 'thenText'];
    if (fields.some(key => typeof draft[key] !== 'string' || draft[key].trim().length > 4000)) return null;
    if (ifThen(draft.ifText, draft.thenText) === null) return null;
    return {stageNeeds: [...context.needs], task: context.task, care: context.care,
        trigger: draft.trigger.trim(), ifText: draft.ifText.trim(), thenText: draft.thenText.trim(), createdAt};
}
