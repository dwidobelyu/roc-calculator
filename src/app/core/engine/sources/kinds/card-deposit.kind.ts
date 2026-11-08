import { MasterEntry } from '../../../models/master-data.models';
import { MasterDataService } from '../../../services/master-data.service';
import { StatOption, StatSourceKind, fixedOption } from '../stat-source';

/** Card "Deposit" (EquipCardTable.CardCollectAttr): cards stored in the card album. */
export class CardDepositKind implements StatSourceKind {
  readonly key = 'cardDeposit';
  readonly label = 'Card deposit';
  readonly hint = 'Cards stored in the card album.';

  async options(data: MasterDataService): Promise<StatOption[]> {
    const deposit = await data.load<MasterEntry[]>('card-deposit.json');
    return deposit.map((e) => fixedOption(e, 'Deposited card'));
  }
}
