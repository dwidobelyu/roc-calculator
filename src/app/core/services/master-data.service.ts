import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Loads the JSON master data shipped in public/data, once per file. */
@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Promise<unknown>>();

  load<T>(file: string): Promise<T> {
    let p = this.cache.get(file);
    if (!p) {
      p = firstValueFrom(this.http.get<T>(`data/${file}`));
      // a failed load must not stay cached, so a retry can succeed
      p.catch(() => this.cache.delete(file));
      this.cache.set(file, p);
    }
    return p as Promise<T>;
  }
}
