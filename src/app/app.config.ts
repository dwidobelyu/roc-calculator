import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { CalculatorPage } from './features/calculator/calculator-page';
import { CardListPage } from './features/items/card-list-page';
import { EquipmentListPage } from './features/items/equipment-list-page';
import { MonsterListPage } from './features/monsters/monster-list-page';
import { SkillListPage } from './features/skills/skill-list-page';
import { StalkerCopyPage } from './features/skills/stalker-copy-page';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // hash URLs so the built site works from any static host or folder without rewrite rules
    provideRouter(
      [
        { path: '', component: CalculatorPage, title: 'ROC Damage Calculator' },
        { path: 'skills/player', component: SkillListPage, data: { owner: 'player' }, title: 'Player skills | ROC Damage Calculator' },
        { path: 'skills/monster', component: SkillListPage, data: { owner: 'monster' }, title: 'Monster skills | ROC Damage Calculator' },
        { path: 'stalker-copy', component: StalkerCopyPage, title: 'Stalker Copy | ROC Damage Calculator' },
        { path: 'monsters', component: MonsterListPage, title: 'Monsters | ROC Damage Calculator' },
        { path: 'cards', component: CardListPage, title: 'Cards | ROC Damage Calculator' },
        { path: 'equipment', component: EquipmentListPage, title: 'Equipment | ROC Damage Calculator' },
        { path: 'skills', redirectTo: 'skills/player' },
        { path: '**', redirectTo: '' },
      ],
      withHashLocation(),
      // route data such as `owner` binds straight to component inputs
      withComponentInputBinding(),
    ),
  ],
};
