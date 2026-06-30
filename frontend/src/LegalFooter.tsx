export default function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-[10px] text-gray-600 flex gap-3 justify-center ${className}`}>
      <a href="/world" className="hover:text-gray-400 transition-colors">
        World
      </a>
      <span aria-hidden="true">·</span>
      <a href="/biosphere" className="hover:text-gray-400 transition-colors">
        Biosphere
      </a>
      <span aria-hidden="true">·</span>
      <a href="/welcome?ref=moltbook&agent=traveler" className="hover:text-gray-400 transition-colors">
        Welcome
      </a>
      <span aria-hidden="true">·</span>
      <a href="/mission-control" className="hover:text-gray-400 transition-colors">
        Mission Control
      </a>
      <span aria-hidden="true">·</span>
      <a href="/hall" className="hover:text-gray-400 transition-colors">
        Hall
      </a>
      <span aria-hidden="true">·</span>
      <a href="/treasury" className="hover:text-gray-400 transition-colors">
        Support (Experimental)
      </a>
      <span aria-hidden="true">·</span>
      <a href="/solcot" className="hover:text-gray-400 transition-colors">
        Builder Marks (Beta)
      </a>
      <span aria-hidden="true">·</span>
      <a href="/privacy-policy.md" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">
        Privacy
      </a>
      <span aria-hidden="true">·</span>
      <a href="/terms-of-service.md" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">
        Terms
      </a>
    </footer>
  );
}
