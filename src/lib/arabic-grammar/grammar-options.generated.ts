/** AUTO-GENERATED from grammar-options.json. Run: node scripts/generate-options.mjs */
export const grammarOptions = {
  "schema_version": "1.1",
  "arabic_grammar": {
    "parts_of_speech": {
      "noun": {
        "subtypes": [
          "common_noun",
          "proper_noun",
          "adjective",
          "pronoun",
          "demonstrative",
          "relative_pronoun",
          "numeral",
          "active_participle",
          "passive_participle",
          "verbal_noun",
          "other"
        ],
        "gender": [
          "masculine",
          "feminine",
          "unknown"
        ],
        "number": [
          "singular",
          "dual",
          "plural",
          "unknown"
        ],
        "plural_type": [
          "sound_masculine",
          "sound_feminine",
          "broken",
          "other",
          "unknown"
        ],
        "case": [
          "nominative",
          "accusative",
          "genitive",
          "indeclinable",
          "unknown"
        ],
        "definiteness": [
          "definite",
          "indefinite",
          "construct",
          "unknown"
        ],
        "definiteness_source": [
          "al",
          "proper_noun",
          "possessive_pronoun",
          "idafa",
          "pronoun",
          "demonstrative",
          "unknown"
        ],
        "idafa_role": [
          "mudaf",
          "mudaf_ilayh",
          "unknown"
        ],
        "rationality": [
          "rational",
          "non_rational",
          "unknown"
        ],
        "derivation": [
          "active_participle",
          "passive_participle",
          "verbal_noun",
          "unknown"
        ],
        "possessor": {
          "allowed": true,
          "person": [
            1,
            2,
            3
          ],
          "gender": [
            "masculine",
            "feminine",
            "not_distinguished"
          ],
          "number": [
            "singular",
            "dual",
            "plural"
          ]
        }
      },
      "verb": {
        "aspect": [
          "perfect",
          "imperfect",
          "imperative"
        ],
        "temporal_meaning": [
          "past",
          "present",
          "future",
          "context_dependent",
          "unknown"
        ],
        "future_marker": [
          "sa",
          "sawfa"
        ],
        "person": [
          1,
          2,
          3
        ],
        "gender": [
          "masculine",
          "feminine",
          "not_distinguished"
        ],
        "number": [
          "singular",
          "dual",
          "plural"
        ],
        "mood": [
          "indicative",
          "subjunctive",
          "jussive",
          "unknown"
        ],
        "energetic_nun": [
          "heavy",
          "light",
          "unknown"
        ],
        "voice": [
          "active",
          "passive",
          "unknown"
        ],
        "verb_form": [
          "I",
          "II",
          "III",
          "IV",
          "V",
          "VI",
          "VII",
          "VIII",
          "IX",
          "X",
          "other",
          "unknown"
        ],
        "negation": {
          "particle": [
            "ما",
            "لا",
            "لم",
            "لن",
            "other"
          ],
          "type": [
            "normal_negation",
            "prohibition"
          ]
        },
        "attached_pronouns": {
          "roles": [
            "subject",
            "direct_object"
          ],
          "person": [
            1,
            2,
            3
          ],
          "gender": [
            "masculine",
            "feminine",
            "not_distinguished"
          ],
          "number": [
            "singular",
            "dual",
            "plural"
          ]
        },
        "weakness": [
          "sound",
          "hamzated",
          "doubled",
          "assimilated",
          "hollow",
          "defective",
          "lafif",
          "other",
          "unknown"
        ],
        "transitivity": [
          "transitive",
          "intransitive",
          "both",
          "unknown"
        ]
      },
      "particle": {
        "subtypes": [
          "preposition",
          "conjunction",
          "negation",
          "prohibition",
          "interrogative",
          "future",
          "conditional",
          "vocative",
          "exception",
          "emphasis",
          "subjunctive_governor",
          "jussive_governor",
          "complementizer",
          "definite_article",
          "result",
          "other"
        ],
        "grammatical_effect": [
          "causes_jussive",
          "causes_subjunctive",
          "governs_genitive",
          "marks_future",
          "marks_negation",
          "marks_prohibition",
          "other"
        ]
      }
    },
    "pronoun_features": {
      "person": [
        1,
        2,
        3
      ],
      "gender": [
        "masculine",
        "feminine",
        "not_distinguished"
      ],
      "number": [
        "singular",
        "dual",
        "plural"
      ]
    },
    "segmentation": {
      "possible_prefix_types": [
        "conjunction",
        "preposition",
        "definite_article",
        "future_particle",
        "interrogative_particle",
        "other"
      ],
      "possible_suffix_types": [
        "possessive_pronoun",
        "object_pronoun",
        "subject_pronoun",
        "number_suffix",
        "gender_suffix",
        "case_ending",
        "other"
      ]
    }
  },
  "constraints_file": "grammar-paths.json"
} as const;

export const grammarVocabulary = grammarOptions.arabic_grammar;
