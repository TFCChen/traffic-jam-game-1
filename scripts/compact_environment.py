"""Keep geometry exact; store environment normals at 16-bit and colours at 8-bit.
glTF KHR_mesh_quantization is supported natively by the existing Three loader.
Vehicle assets are never processed by this helper.
"""
import json,struct,os

def compact_environment_glb(path):
    data=open(path,'rb').read()
    json_size=struct.unpack_from('<I',data,12)[0]
    document=json.loads(data[20:20+json_size])
    binary=data[28+json_size:]
    conversions={}
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            for attribute in ('NORMAL','COLOR_0'):
                index=primitive['attributes'].get(attribute)
                if index is None:continue
                accessor=document['accessors'][index]
                if accessor['componentType']!=5126:continue
                view_index=accessor['bufferView'];view=document['bufferViews'][view_index]
                if view_index in conversions:continue
                # Blender emits dedicated views. Refuse to rewrite interleaved
                # data rather than accidentally touching positions or UVs.
                if sum(a.get('bufferView')==view_index for a in document['accessors'])!=1:raise ValueError('Expected dedicated attribute view')
                components={'VEC3':3,'VEC4':4}[accessor['type']]
                stride=view.get('byteStride',components*4)
                start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
                packed=bytearray()
                for vertex in range(accessor['count']):
                    values=struct.unpack_from('<'+'f'*components,binary,start+vertex*stride)
                    if attribute=='NORMAL':
                        packed.extend(struct.pack('<hhh',*(round(max(-1,min(1,v))*32767) for v in values)));packed.extend(b'\0\0')
                    else:
                        packed.extend(bytes(round(max(0,min(1,v))*255) for v in values))
                        packed.extend(bytes(4-components))
                accessor['componentType']=5122 if attribute=='NORMAL' else 5121
                accessor['normalized']=True;accessor['byteOffset']=0
                view['byteStride']=8 if attribute=='NORMAL' else 4
                conversions[view_index]=bytes(packed)
    chunks=bytearray()
    for index,view in enumerate(document['bufferViews']):
        source=conversions.get(index,binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])
        chunks.extend(bytes((-len(chunks))%4));view['byteOffset']=len(chunks);view['byteLength']=len(source);chunks.extend(source)
    document['buffers'][0]['byteLength']=len(chunks)
    for field in ('extensionsUsed','extensionsRequired'):
        document[field]=list(dict.fromkeys(document.get(field,[])+['KHR_mesh_quantization']))
    encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    chunks.extend(bytes((-len(chunks))%4))
    output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(chunks))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(chunks),0x004e4942)+chunks
    staged=path+'.compact';open(staged,'wb').write(output);os.replace(staged,path)
    print('ENVIRONMENT_COMPACT',len(data),'->',len(output))

if __name__=='__main__':
    import sys
    if len(sys.argv)>1:compact_environment_glb(sys.argv[-1])
