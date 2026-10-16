import RpcButton from './RpcButton';

export default function CampaignPauseButton({ id, paused }: { id: string; paused: boolean }) {
  return <RpcButton fn="set_campaign_paused" args={{ p_campaign: id, p_paused: !paused }} label={paused ? 'Retomar campanha' : 'Pausar campanha'} done={paused ? 'Campanha retomada' : 'Campanha pausada'} />;
}
