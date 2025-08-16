import Image from 'next/image';

interface MovieCardProps {
  title: string;
  poster: string;
  overview: string;
  release_date: string;
  cast: string[];
  imdb_rating?: number;
  streaming_sources: string[];
}

export default function MovieCard({ title, poster, overview, release_date, cast, imdb_rating, streaming_sources }: MovieCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-md w-64">
      <div className="relative h-96 w-full">
        <Image src={poster} alt={title} layout="fill" objectFit="cover" />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm mb-2">{overview}</p>
        <p className="text-xs mb-1">Release: {release_date}</p>
        {imdb_rating && <p className="text-xs mb-1">IMDb: {imdb_rating}</p>}
        <p className="text-xs mb-1">Cast: {cast.join(', ')}</p>
        {streaming_sources.length > 0 && (
          <p className="text-xs">Available on: {streaming_sources.join(', ')}</p>
        )}
      </div>
    </div>
  );
}
