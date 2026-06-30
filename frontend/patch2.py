import sys

file_path = r'd:\Hearth\prosper2\frontend\src\world\WorldObject.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchObjectData}'''

replacement = '''              <div className="flex items-center gap-1.5">
                {onPrev && (
                  <button onClick={onPrev} className="p-1.5 rounded border border-white/10 hover:bg-white/5 text-[#8E7E6B] hover:text-white transition">
                    <ChevronLeft size={14} />
                  </button>
                )}
                {onNext && (
                  <button onClick={onNext} className="p-1.5 rounded border border-white/10 hover:bg-white/5 text-[#8E7E6B] hover:text-white transition">
                    <ChevronRight size={14} />
                  </button>
                )}
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button 
                  onClick={fetchObjectData}'''

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Header patched successfully.')
else:
    print('Target not found.')
